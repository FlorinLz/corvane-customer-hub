# Customer Hub: build brief for Claude Code

**Version:** 1.0, 3 October 2026. Product Owner: Florin Lazar. Prepared by the Product Manager (Claude) with a team of specialist agents.
**Version note:** Adds the issue flow (M17 to M27), 5 October 2026.
**Status:** ready for implementation.

## 0. How to use this brief

This document is self-contained. It holds everything needed to build Customer Hub: product context, architecture, data model, business rules, screens, seed data, tests and the build plan. Appendix A holds the full acceptance criteria for the 16 MVP stories (M1 to M16). Every reference such as "M6 AC4" points to Appendix A.

Appendix B holds the acceptance criteria of the issue flow (M17 to M27, added 5 October 2026), with the same authority as Appendix A. A reference such as "M19 AC5" points to Appendix B. Milestones 1 to 3 were built and merged before the issue flow was added; the issue flow is built in milestones 6A, 6B, 6C (R1) and 12A (R2) of section 7.4, and only when the Product Owner says so.

**Order of authority when two parts disagree:**
1. Section 1.6 "Decisions log" in this document.
2. Section 4 "Business rules" and section 3 "Architecture, data model and integrations".
3. Appendix A and Appendix B "Acceptance criteria".
4. Sections 5 and 6 "UI".
5. Section 7 "Seed data, demo mode, tests and build plan".

If you find a gap or a conflict, choose the option that keeps the acceptance criteria true, write it down in `DECISIONS.md` at the repository root, and continue.

**Design input:** the screens are designed first in Claude Design from the companion design brief (15_claude_design_brief.md). Follow that design for layout, visual hierarchy and component styling. This build brief wins on behaviour, data, permissions, states and copy. If the design shows something this brief does not support, keep the behaviour of this brief and note it in `DECISIONS.md`. The issue screens follow design brief section 6 "Screens (part 3): issue flow".

**How to work:**
1. Read sections 1 and 2 (including 1.7 "Release plan"), then section 7.4 (build plan) and section 7.6 (release cut).
2. Build the Release 1 (R1) milestones first, in order (7.4, milestones 1 to 8, with the issue milestones 6A, 6B and 6C between 6 and 7 once the PO starts the issue flow). Each R1 milestone delivers only the R1 ACs listed for it in 7.4 and 7.6. After each milestone run the tests listed in its "done when" check.
3. Read the matching parts of sections 3 to 6 and Appendix A for each milestone. You do not need to read the whole document up front. The "Release" line under each screen heading in sections 5 and 6 tells you which parts belong to R1.
4. Use the seed data in section 7.1 exactly. The demo scenarios depend on it. The full schema and the full seed are built in R1.
5. Stop at "Gate: R1 demo-ready" in 7.4. Run its checklist and report to the Product Owner: the checklist results, the test results, and any entries added to `DECISIONS.md` during R1.
6. Continue to the Release 2 (R2) milestones (7.4, milestones 9 to 13, with 12A) only when the Product Owner says so. R2 builds on R1 with no schema migration.

## 1. Product context

### 1.1 The company

Corvane (written "Corvane" since September 2026, legal name International Payments Identity (Corvane) Pte. Ltd., with Corvane Europe B.V. in the EU) runs a global payee verification network: "Know Your Payee". Banks, fintechs and payment service providers call Corvane before a payment to check that the account belongs to the intended payee. Corvane is a Routing and Verification Mechanism in the EU Verification of Payee (VoP) scheme, a certified aggregator for UK Confirmation of Payee (CoP), and offers global validation in other countries. Many banks are both customers (they send checks) and network partners (they answer checks).

### 1.2 The problem

Customer information lives in CRM, billing, Jira, email and spreadsheets. Six teams work on the same institutions and none of them has the full picture. The 9 problems, grouped in 3 causes:

| Cause | # | Problem | Consequence |
|---|---|---|---|
| A. No single correct customer record | 1 | Data scattered across systems | Teams give customers different answers, and time goes into searching |
| | 2 | Entity complexity: the same bank is customer and partner, groups have several legal entities, LEI and BIC | Wrong entity invoiced, wrong contract applied in an incident |
| | 3 | Data quality with no field owner | Nobody fixes wrong data, duplicates appear |
| | 4 | No interaction history and no internal owner | Customers repeat themselves, context is lost when people leave |
| B. Customer state over time is invisible | 5 | Integration status per product and scheme | Go-lives slip, billing starts late |
| | 6 | Key contacts go stale, including incident contacts | Incidents reach the wrong person |
| | 7 | KYB data expires (licences, LEI, ownership, sanctions) | Audit findings, regulatory exposure |
| | 8 | Contract obligations per customer (incident notice, subprocessor notice, audit rights) | Missed contractual deadlines |
| C. No control over data | 9 | No access roles, no audit trail, irreversible wrong edits | Due diligence questions cannot be answered, data is lost |

**The central problem (PO, 5 October 2026).** When a customer or a partner reports a problem (verifications that return wrong results, latency above the 5-second limit, a partner bank that does not answer, a wrong invoice, a possible data breach), Corvane cannot handle it in a controlled way. The issue reaches whoever is asked first, by email, Slack or phone. Nobody sees in one place which entity is affected, under which contract, who owns it, how soon the customer must be told and which other customers are hit. Corvane then misses deadlines it cannot see: a contract asks for notice within 2 hours and the team writes after 5; the bank has 4 hours to report to its regulator (DORA) and cannot do it without Corvane's facts; after the incident Corvane cannot show the bank's auditor who knew what, and when. The 9 problems above stay and become the causes that make an issue hard to handle. Problem 8 widens: the customer's regulator deadline (DORA in the EU, FCA in the UK, regulators in the US, Singapore and the UAE), imposed on Corvane through the contract, also counts.

| Cause | # | Problem | Consequence |
|---|---|---|---|
| C. No owner, trace and control | 10 | Issues have no single entry point, no named owner and no computed priority. They arrive by email, Slack, phone or the account manager; nobody assigns them by type; whoever receives them sets the priority without the contract, scheme or regulator; nothing shows the time left to the notification deadline | Urgent issues queue next to minor ones and notification deadlines pass unnoticed. One issue is handled by two people or by nobody, a partner incident misses affected customers, and Corvane has no proof of its reaction when the bank or its auditor asks |

### 1.3 Users

Six teams use Customer Hub. Each team edits only its own data area, everyone else reads it, and every team can add notes.

| Team | Main job in Customer Hub | Problems |
|---|---|---|
| Sales (Sales Director) | Create the customer at signature and hand over everything promised, once | 1, 5, 6 |
| Ops / Onboarding | Set up the right structure and see what blocks go-live | 1, 2, 3, 5, 6 |
| Customer Success | Own the customer long term: history, people, renewals | 1, 4, 5, 6 |
| Network | Reach the incident contact fast and manage partner coverage | 2, 6, 8 |
| Compliance | Show what was verified, when, by whom, and what expires | 7, 8, 9 |
| Finance | Invoice the right legal entity from the right Corvane entity | 1, 2, 3 |

Customer lifecycle: Sales owns the customer at signature, Ops through onboarding and hypercare, Customer Success from Ramp-up and BAU. The current owner changes at handoffs.

### 1.4 MVP scope: the 16 stories

| ID | Story (short) | Problems |
|---|---|---|
| M1 | Search an institution and open one record with entities, roles, products, stages, people, owner, history | 1, 2, 3 |
| M2 | Sales creates the customer with GLEIF lookup and a duplicate warning | 2, 3 |
| M3 | Sales records products, terms and target go-live, then hands off to a named Onboarding Manager | 1, 4, 5 |
| M4 | Ops links group entities, attaches contracts, sets roles | 2 |
| M5 | Network records partner coverage by country and scheme with status history | 2, 5 |
| M6 | Ops tracks the onboarding stage per product and scheme, with blocks | 5 |
| M7 | Contacts with explicit roles, incident contact first on partners | 6 |
| M8 | Ops hands off to Customer Success with a structured summary | 1, 4, 5 |
| M9 | Customer Success sets and reassigns the internal owner | 4 |
| M10 | Shared history: notes and an automatic timeline | 1, 4 |
| M11 | Personal worklist per team | 3, 5, 6, 7 |
| M12 | KYB checks with who, when and evidence, plus periodic review | 7, 9 |
| M13 | Contract obligations per customer and partner agreement | 8 |
| M14 | Billing profile and the "Incomplete for billing" flag | 2, 3 |
| M15 | Predefined roles and field ownership | 3, 9 |
| M16 | Audit log and recoverable soft delete | 9 |

**Issue flow stories (M17 to M27, Appendix B, added 5 October 2026):**

| ID | Story (short) | Problems |
|---|---|---|
| M17 | Any team reports an issue on the affected entity (on a group, one per selected entity), sees open similar issues and can add to one; the portal proposes the severity | 10, 1, 2 |
| M18 | Automatic routing by type, the customer's issue team and business hours; the reporter sees owner, communicator and the first deadline | 10, 4 |
| M19 | Severity and clocks from impact, product stage, the contract's notification time and the customer's facts deadline; the owner changes severity or type with a reason | 10, 8, 5 |
| M20 | "Issues" first on every Home, ordered by time left, with "Contributing" and "Reported by me" | 10, 3 |
| M21 | The owner acknowledges, changes status, resolves with root cause and solution, adds contributors and notes, reassigns within the team | 10, 4 |
| M22 | The communicator sees the incident contact, gets the prefilled message with "Open in Gmail", records notifications and updates, closes and reopens with the customer | 6, 8, 10 |
| M23 | Partner issue: Degraded proposal, affected customers, one linked issue per customer, cascade resolution | 2, 5, 10 |
| M24 | Escalation to the admin ("At risk"): phase 2, no ACs | 10, 4 |
| M25 | Compliance flag and assessment (possible major incident, possible data breach, neither) | 8, 9, 10 |
| M26 | Regulatory block on the Customer agreement card | 8 |
| M27 | Root cause report task after a Sev-1 at a regulated customer (R2) | 9, 4 |

Out of scope (phase 2) is listed in section 7.5.

### 1.5 Demo scenarios

The MVP is shown in a 20-minute interview presentation that focuses on the product thinking. The app appears in short blocks, so each scenario must work on its own and in any order.

| # | Scenario | Teams | Problems |
|---|---|---|---|
| 1 | New customer end to end: Sales creates Santander Consumer Bank GmbH live (GLEIF lookup, duplicate warning), hands off to Ops; Ops confirms and moves stages; Revolut Ltd is handed off to Customer Success at Ramp-up | Sales, Ops, Finance, CS | 1 to 6 |
| 2 | Partner incident: Lloyds Bank plc UK CoP degrades; Network reaches the incident contact in under a minute and lists affected customers; Compliance reads the notification deadlines | Network, Compliance | 1, 2, 4, 6, 8 |
| 3 | Audit and due diligence: KYB evidence, expiring items, Roles & permissions, audit log, soft delete and reactivation of Monzo Bank Ltd | Compliance, Sales, admin | 3, 7, 9 |
| 4 | A day in the life of a CSM: worklist, acknowledge an assignment, QBR note on Banca Monte dei Paschi di Siena, reassign Adyen during leave | Customer Success | 1, 4, 6 |
| 5 | Issue flow (main scenario): ISS-1042 routed at night to the Ops on-call person and handed over to Emma Wilson at 09:00 CEST; a report on Revolut Ltd with open similar issues; the Lloyds Bank plc partner issue with the Degraded proposal, affected customers, linked issues and cascade resolution; Compliance assessment; "Open in Gmail", recorded notifications and close | All six teams | 10, with 2, 4, 6, 8 |

The Playwright tests in section 7.3 encode these scenarios step by step. R1 runs the short version of each scenario (7.6.4); R2 runs the full versions.

Scenario 5, the issue flow (M17 to M27), is the main scenario of the presentation (decision B15). It reuses the partner incident of scenario 2: Network now creates the Lloyds Bank plc partner issue live (M23). Its Playwright spec is E2E-5 (7.3.2), which also checks the hand-over of the seeded night issue ISS-1042. "View as" keeps one user per team (Ops: Adrian Koh), so Kevin Lim's night view of ISS-1042 is shown on the design artboards and through Adrian Koh's "My team" scope in the Issues section.

### 1.6 Decisions log (binding)

| # | Decision |
|---|---|
| D1 | Ops owns the contract reference on the Customer role. The Billing tab shows it read-only and the billing flag still checks it |
| D2 | The Sales → Ops handoff has Confirm only. Decline is phase 2. The Ops → CS handoff has Accept, Decline and Cancel |
| D3 | Sales and Finance both edit commercial terms. Every change is audited |
| P2 | A "Details" tab, second after Overview, holds every entity-level edit (entity core, Customer role card, Partner role and agreement reference, roles, lifecycle Inactive). Overview is read-only |
| P3 | Real banks and fintechs with real LEIs, verified in GLEIF. Institutions publicly announced as Corvane customers or partners are excluded. Contracts, stages, incidents, KYB results and contacts are fictional. No demo data banner |
| P4 | A read-only "Roles & permissions" page under Admin, visible to Compliance and the admin, generated from the same matrix the server enforces |
| B1 | Entities with no active product lines and a Partner role (partner-only or dual-role): lifecycle is Live when at least one coverage row is Active or Degraded, otherwise Onboarding (Inactive when Ops marks it) |
| B2 | Lloyds Bank plc partner agreement: incident notification 1 hour (scenario 2 value) |
| B3 | UniCredit Bank GmbH's real LEI renewal date falls on 22 Oct 2026, so it appears on the Compliance worklist as "LEI renewal due". Keep it: it is a real example of problem 7 |
| B4 | Text links use #0B6E8E (a darker shade of the brand link blue #118AB2) to meet the 4.5:1 contrast ratio |
| B5 | Routes: `/` Home, `/search`, `/customers/new`, `/entities/[id]/[tab]` (overview, details, products, contacts, history, partner, compliance, billing, audit), `/groups/[id]`, `/handoffs/[id]`, `/handoffs/new?entity=[id]`, `/admin/users`, `/admin/deleted-records`, `/admin/roles-permissions` |
| B6 | Lifecycle is a stored derived column, recomputed on every write and also on read when a scheduled coverage change has reached its effective date |
| B7 | Country and scheme filters (Search and Obligations view) match the country of the product line or coverage row. Example: Revolut Ltd (GB entity) with EU VoP in DE does not match "GB + EU VoP" |
| B8 | Default "View as" user when no cookie is set: Adrian Koh (Ops, admin). Section 4 model sketches map to the 3.2.2 schema through the "Schema of record" row; 3.2.2 is the only schema |
| B9 | Two-release build with a decision gate (PO, 3 October 2026). Release 1 (R1) is a thin slice through all 16 stories and all 9 problems and is built first. At "Gate: R1 demo-ready" (7.4) the build stops and reports; Release 2 (R2, the full spec) starts only when the PO says so. If R2 does not start, R1 is the demo build. Nothing is deleted from the spec: R1 + R2 = Appendix A. Section 7.6 is the binding release map |
| B10 | Four PO "R2" items are pulled into R1 because the short scenarios need them: Acknowledge on the Home row (M9 AC10 part, M11 AC12; the header banner stays R2); the whole Roles & permissions page (M15 AC13; team change history stays R2); contact time zone and availability shown in the header and contact rows (M7 AC10); Ownership, Sanctions and periodic review shown read-only, with review Overdue computed for the worklist and Overview (M12 AC1, AC11 part, AC12 part; editing stays R2) |
| B11 | Ops → CS handoff: send and Accept are R1, so ownership moves to the CSM in R1. Decline and Cancel are R2 (M8 AC10 part, AC12, AC13, AC15 part) |
| B12 | Contact time zone and availability capture, with the M7 AC4 required rules, is R1. Every contact created or edited in R1 has a time zone, so the "Time zone not recorded" state never occurs |
| B13 | The dependency guards in 7.6.9 are binding R1 rules. Each guard is lifted by the R2 milestone that delivers its partner AC |
| B14 | Scenario 1 short includes moving Revolut Ltd UK CoP / GB from Live & hypercare to Ramp-up before the Ops → CS handoff (E2E-1 step 11, an R1 forward move) |
| B15 | The issue flow is the main process of Customer Hub (PO, 5 October 2026). Its R1 part (Appendix B release split, 7.6.12) is built in R1 milestones 6A, 6B and 6C, between milestones 6 and 7; its R2 part is milestone 12A. The central problem and problem 10 join section 1.2 |
| B16 | Routing without manual assignment: the type gives the owner team, the report form has no owner, communicator or contributor field, and routing rules 1 to 8 of Appendix B run in the save transaction (4.9.2) |
| B17 | Business hours per department: Monday to Friday, 09:00 to 18:00 local time. Ops Asia/Kuala_Lumpur; Network, Compliance and Finance Asia/Singapore; Sales and Customer Success each user's own time zone. Ops, Network, Compliance and Finance users take their team's time zone. No holiday calendar. Seeded user time zones in 7.1.17.1 |
| B18 | Issue team per customer: the customer owner (M9), the Sales person (the Sales user who created the record; Tom Hadley when that user is inactive) and one named person each from Ops, Network, Finance and Compliance. Seed defaults where the seed names nobody: Ops Adrian Koh (Revolut Ltd: Kevin Lim), Network Lukas Brenner, Compliance Mei Chen, Finance Rachel Wong. Shown read-only on Details; editing is phase 2 |
| B19 | On-call for Ops, Network and Compliance only, from a seeded rota (this week: Ops Kevin Lim, Network Nora Lee, Compliance Mei Chen). Sales and Finance have no on-call: a possible data breach reported outside business hours on a Billing or Commercial or coverage issue (Sev-1 by B25) goes to the Compliance on-call person as owner (the type stays unchanged), who is also the communicator until the customer owner's business hours start (rule 3); the entity's named Finance or Sales person is added as contributor (PM, 5 October 2026; 4.9.2). Editing the rota is phase 2 |
| B20 | Communicator hand-over: on a Sev-1 saved outside the owner team's hours (rule 3), or while the customer owner is outside their own hours (rule 3b), the issue owner is also the communicator until the customer owner's business hours start. Then communication passes to the customer owner with a system note of what was already communicated. Ownership stays with the issue owner, who can reassign it |
| B21 | Escalation to the admin (M24, "At risk", 75 % threshold, reassignment by the admin) is phase 2 |
| B22 | Contributors see their issues on Home in the "Contributing" group, after the main list, with no clock and no step; "Reported by me" follows. Both groups count in the section title "Issues (n)" and never in the Home badge |
| B23 | Message template: the communicator gets a prefilled first notification with "Copy message" and "Open in Gmail" (Gmail compose URL, 4.9.10). Customer Hub sends nothing; the communicator records the notification. Sending through the Gmail API is phase 2 |
| B24 | Seed monitoring issue ISS-1042: reporter "Monitoring (automatic)", saved the evening before the demo day at 21:12 Europe/Amsterdam (21:12 CEST, 03:12 MYT), acknowledged by Kevin Lim at 21:21 CEST, Compliance assessment recorded at 21:58 CEST, first notification recorded at 22:05 CEST by email to the MPS incident contact, status In progress; at 09:00 CEST communication passes to Emma Wilson with the system note. It shows night routing and the hand-over in the demo. Real monitoring integration is phase 2 |
| B25 | "Possible data breach = Yes" always gives Sev-1 and overrides every cap, including the before-go-live cap: a breach carries a legal duty at any stage |
| B26 | Billing and Commercial or coverage issues are capped at Sev-2, because their owner teams (Finance, Sales) have no on-call |
| B27 | Before go-live (Contract signed to Go-live approval) the maximum severity is Sev-3 and no notification clock starts. With no product line selected, the most advanced stage on the selected scheme and country decides |
| B28 | Partner issues: the issue owner (Network) communicates with the partner, Lloyds Bank plc included. Linked customer issues inherit the parent's owner, follow it on every owner change and need no separate acknowledgement; each has its own communicator (that customer's owner) and its own notification deadline from that customer's contract |
| B29 | A report on a group creates one issue per selected entity (rule 8), linked to each other under "Related issues" |
| B30 | Sev-2 customer notification target: 4 business hours of the communicator. 1 business day = 9 business hours of the owner (Sev-4: 27) |
| B31 | The facts clock for the customer's regulator is R2 and shows "Facts deadline not captured" in red when the card has no value. "Remind customer" (the communicator's step) and both automatic closes are R2 |
| B32 | Times on issue screens display in the viewer's time zone with an abbreviation from a fixed map: CET/CEST, EET/EEST, WET/WEST, GMT/BST, MYT, SGT, EST/EDT (3.3.6). Seed times are stored as local times in the stated zone and converted |
| B33 | "Wrong match result": owner Ops, Network as default contributor, communicator the customer owner |
| B34 | The regulatory block (M26) uses the seed table of the Appendix B conventions (7.1.17.6) |
| B35 | M23 brings the list of customers affected by a partner issue into the MVP (phase 2 item N6 in 7.5.2 before). The list uses scheme and country; real routing data stays phase 2 |
| B36 | Build: time-based issue state is computed on read from the demo clock (`src/lib/dates.ts`). There is no scheduled job, because the host has no reliable cron. A read may trigger only idempotent system writes whose moment has passed: the communicator hand-over note, the owner of a queued issue with no named person, and in R2 the automatic closes (4.9.7) |
| B37 | Build: the issue models arrive through one additive migration, `0003_issue_flow`, in milestone 6A (3.2.6). It is the one exception to "Milestone 2 creates every model" (1.7). It carries every issue model, enum and field of R1 and R2, so milestone 12A adds no migration |
| B38 | Build: routes `/issues/[issueId]` (display ID, for example `/issues/ISS-1042`) and `/entities/[id]/issues` (Issues tab, after History in the tab bar); the report panel opens with `?report=1` on `/entities/[id]/issues` and `/groups/[id]` (6.13) |

### 1.7 Release plan

The build runs in two releases (decision B9). The AC-level map is section 7.6; the milestones are in 7.4.

| # | Problem | R1 (thin slice, demo-ready on its own) | R2 adds |
|---|---|---|---|
| 1 | Data scattered | Search by name, alias, LEI or BIC with Country and Scheme filters; one record with header, Overview, Details and every tab; shared History timeline | Role, Stage, Coverage status, Lifecycle and Owner filters; user sorts; typeahead; contract ID search |
| 2 | Entity complexity | GLEIF lookup with group suggestion; group record with exposure tiles; Link and Unlink entity; add a role; attach an entity contract; customer and partner chips on dual-role entities | Create group and create from GLEIF parent; move entity; master and partner agreement attach; role removal |
| 3 | Data quality, no field owner | Duplicate panel with reason; "Owned by <Team>" enforced on the server; Ops "Required fields empty"; "Incomplete for billing" flag and badge | LEI status overrides and manual entry; entity core edit; Finance billing profile edit and worklists |
| 4 | No history, no owner | Sales → Ops handoff with Confirm pickup; Ops → CS send and Accept; Reassign owner; Acknowledge on Home; notes with participants and action items | Ops → CS Decline and Cancel; Change Onboarding Manager; header assignment banner; note edit; action item toggle; History filters |
| 5 | Integration status | 9-stage band per product line; forward stage move; block and resolve; "Billable from"; Ops "Blocked", "Go-lives in the next 14 days" and "Too long in current stage" | Skip and back moves; Edit block; Edit target go-live; add, edit and cancel product line; Sales "Overdue go-lives" |
| 6 | Stale contacts | Roles and owning team; primary incident contact first on partners with local time and availability; Add and Edit contact with time zone and availability; Mark as verified | Mark as left; Set as primary; contact duplicate warning; "Copy details from"; Network and Finance stale-contact worklists; Sales "Champion left" |
| 7 | KYB expiry | All four KYB cards and the periodic review card; Licence verification with evidence link; LEI refresh from GLEIF; review Overdue computed; Compliance expiries worklist | Ownership and Sanctions edit; schedule and complete periodic review |
| 8 | Contract obligations | Customer agreement card with Edit; Obligations view with Customer rows, Incident notice filter and sort | Partner agreement card; Partner rows; Subprocessor notice filter; obligation expiry badge |
| 9 | No control over data | Six teams and one matrix enforced on the server; "View as"; Roles & permissions page; audit in the same transaction; Audit tab; soft delete, Deleted records, Reactivate; Reset demo data | Users & roles with team change and Change history; Audit filters; reactivation with a reused LEI |
| 10 | Issues without entry point, owner and priority | Report on the entity or group with similar issues and "Add to existing issue"; routing by type, issue team, business hours and on-call, with the communicator hand-over; severity with caps; acknowledge, notification and Compliance assessment clocks; Issues section first on Home with Contributing and Reported by me; owner actions; incident contact, prefilled message with "Open in Gmail", notification log and close; partner issue with affected customers, linked issues and cascade; Compliance flag and assessment; regulatory block on the Customer agreement card | Absence and backup routing; fine recalculation when severity drops; facts and data breach clocks; update cadence; "Remind customer" and automatic closes; reopen, new linked issue after 10 business days and take over communication; post-incident report period and root cause report task |

**Decision gate.** After milestone 8 the build stops at "Gate: R1 demo-ready" (7.4) and reports to the PO. If time allows, the PO starts R2 (milestones 9 to 13). Otherwise the build stops at R1, which runs all four short scenarios on its own.

**Issue flow (decisions B15 to B38).** R1 milestones are 1 to 8 with 6A, 6B and 6C between 6 and 7; the R2 part of the issue flow is milestone 12A. The Appendix B release split is mapped in 7.6.12. The R1 effort share in 7.6.10 covers M1 to M16 only.

**R1 share of effort:** about 68% of the full build (range 60 to 70%). The foundation is shared and cannot be split: full schema, full seed, permission matrix, audit service, GLEIF with cache and the duplicate check. Detail in 7.6.10.

**Rule: the full schema and seed are built in R1.** Milestone 2 creates every model, enum and hand-written SQL object of section 3.2 and loads all of 7.1. R2 adds routes, services and screens only, with no migration. Fields that only R2 writes exist from R1 and stay null.

**Exception for the issue flow (decision B37).** The issue models, enums and fields of 3.2.6 arrive in milestone 6A through migration `0003_issue_flow`, and the issue seed of 7.1.17 loads from then on. The same rule applies inside the issue flow: 6A creates every issue field, including the fields only milestone 12A writes, so 12A needs no migration.

Note: the labels R1 and R2 always mean releases. The duplicate check queries in 3.6.2 are labelled Q1 to Q4.

## 2. Tech stack and principles

- **Stack:** Next.js (App Router) and TypeScript; PostgreSQL through Prisma (with the `pg_trgm` extension); Tailwind CSS with the brand tokens as CSS variables; shadcn/ui components on Radix, restyled to the brand; Zod for validation; Vitest for unit tests; Playwright for end-to-end tests.
- **Run locally:** `docker compose up` starts Postgres, `npm run db:reset` migrates and seeds, `npm run dev` starts the app.
- **Sign-in:** none in the MVP. With `DEMO_MODE=true` the session is a seeded user picked in the "View as" switcher. Production would use company SSO (phase 2).
- **Permissions on the server:** every write checks the ownership matrix and returns 403 when it fails. The UI hides controls, but the server is the source of truth.
- **One service layer for writes:** it validates, checks permissions and the record version, and writes the change, the audit entry and the History event in one transaction.
- **Computed values are computed:** worklists, the billing flag, KYB statuses and overview alerts are calculated at read time and never stored. Lifecycle state is the one derived value kept as a column (for search filtering): it is recomputed in the same transaction as every write that can change it (3.2.4, 4.3.6).
- **Audit is immutable:** the application database role can only insert and read audit entries. Demo reset is the only exception.
- **UI language:** English, British spelling, sentence case, DM Sans, Corvane brand tokens.

---

## 3. Architecture, data model and integrations

### 3.1 Architecture

#### 3.1.1 Folder structure

```
customer-hub/
├── docker-compose.yml               # postgres:16 on 5432, mounts docker/initdb
├── docker/initdb/01-roles.sql       # creates roles hub_owner and hub_app, database customer_hub
├── .env.example                     # every variable in 3.1.5
├── data/gleif-cache.json            # cached GLEIF records for the demo LEIs (3.5.5)
├── prisma/
│   ├── schema.prisma                # 3.2
│   ├── migrations/
│   │   ├── 0001_init/               # generated by prisma migrate
│   │   ├── 0002_constraints/        # hand-written SQL in 3.2.3 (partial indexes, audit trigger, checks)
│   │   └── 0003_issue_flow/         # issue flow models, enums and SQL (3.2.6), milestone 6A
│   ├── grants.sql                   # runtime rights for hub_app (3.2.3)
│   └── seed/
│       ├── index.ts                 # CLI entry used by npm run db:seed
│       ├── seed.ts                  # export async function seed(db: PrismaClient, today: LocalDate)
│       ├── dates.ts                 # d(offsetDays): date relative to today in Europe/Bucharest
│       └── data/                    # users.ts, groups.ts, entities.ts, contracts.ts, products.ts,
│                                    # coverage.ts, contacts.ts, compliance.ts, billing.ts, handoffs.ts, history.ts,
│                                    # issues.ts, issue-team.ts, on-call.ts (issue flow, 7.1.17)
├── scripts/
│   ├── db-reset.ts                  # migrate reset + grants + seed (npm run db:reset)
│   └── gleif-snapshot.ts            # rewrites data/gleif-cache.json from the live API (npm run gleif:snapshot)
├── src/
│   ├── app/                                   # Next.js App Router
│   │   ├── layout.tsx                         # S0 shell: top bar, search, View as, toasts
│   │   ├── page.tsx                           # S1 Home: my worklist
│   │   ├── not-found.tsx                      # "We couldn't find that page. Search for a customer or go to Home."
│   │   ├── search/page.tsx                    # S2 (view=institutions | obligations)
│   │   ├── customers/new/page.tsx             # S3 New customer wizard (Sales only)
│   │   ├── entities/[id]/
│   │   │   ├── layout.tsx                     # S4.0 header + tab bar; deleted and not-found handling
│   │   │   ├── page.tsx                       # redirects to /entities/[id]/overview
│   │   │   ├── overview/page.tsx              # S4.1 Overview
│   │   │   ├── details/page.tsx               # S4.9
│   │   │   ├── products/page.tsx              # S4.2 (hidden for partner-only)
│   │   │   ├── contacts/page.tsx              # S4.3
│   │   │   ├── history/page.tsx               # S4.4
│   │   │   ├── issues/page.tsx                # S4.10 Issues tab (issue flow, 6.13)
│   │   │   ├── partner/page.tsx               # S4.5 (partner role only)
│   │   │   ├── compliance/page.tsx            # S4.6
│   │   │   ├── billing/page.tsx               # S4.7
│   │   │   └── audit/page.tsx                 # S4.8 (Compliance and admin)
│   │   ├── handoffs/new/page.tsx              # S6 view B: Ops → CS form (?entity=[id], Ops only)
│   │   ├── handoffs/[id]/page.tsx             # S6 views A and C: pickup and acceptance
│   │   ├── groups/[id]/page.tsx               # S5
│   │   ├── issues/[issueId]/page.tsx          # S8 Issue page by display ID, e.g. ISS-1042 (issue flow)
│   │   ├── admin/users/page.tsx               # S7.1
│   │   ├── admin/deleted-records/page.tsx     # S7.2
│   │   ├── admin/roles-permissions/page.tsx   # S7.3
│   │   └── api/                               # route handlers, one folder per path in 3.8
│   ├── server/
│   │   ├── db.ts                    # PrismaClient on DATABASE_URL (hub_app)
│   │   ├── db-admin.ts              # PrismaClient on DATABASE_ADMIN_URL (hub_owner), used only by Reset demo data
│   │   ├── session.ts               # getCurrentUser(): signed cookie → fresh User row
│   │   ├── http.ts                  # handle(name, fn): auth, error mapping, JSON responses
│   │   ├── errors.ts                # ValidationError 400, UnauthenticatedError 401, ForbiddenError 403,
│   │   │                            # NotFoundError 404, ConflictError 409, DeletedError 410, GleifUnavailableError 503
│   │   ├── permissions/
│   │   │   ├── matrix.ts            # THE ownership matrix (M15 AC3); rendered by S7.3, enforced by guard.ts
│   │   │   └── guard.ts             # assertCan(), contactOwnerTeams(), canSee*() helpers
│   │   ├── audit/
│   │   │   ├── record.ts            # recordChanges(): one AuditEntry per changed field
│   │   │   └── history.ts           # addHistory(): one HistoryEvent per business action
│   │   ├── services/                # all writes; one file per aggregate:
│   │   │                            # customer-wizard, entity, group, customer-role, contract, partner,
│   │   │                            # coverage, product, contact, handoff, owner, note, kyb, review,
│   │   │                            # obligations, billing, admin-users, deletion, demo,
│   │   │                            # issue, issue-report, issue-communication, issue-partner,
│   │   │                            # compliance-assessment (issue flow, 4.9)
│   │   ├── queries/                 # all reads: search, obligations, typeahead, header, overview, details,
│   │   │                            # products, contacts, history, partner, compliance, billing, audit,
│   │   │                            # group, worklist/{sales,ops,cs,network,compliance,finance,issues}.ts,
│   │   │                            # issues, issue-context, affected-customers (issue flow)
│   │   ├── derived/                 # pure functions: lifecycle, coverage-status, kyb-status, review-status,
│   │   │                            # billing-flag, alerts, availability-now, severity, issue-clocks,
│   │   │                            # issue-steps, communicator (issue flow)
│   │   ├── gleif/                   # client.ts, cache.ts, map.ts (3.5)
│   │   ├── duplicates.ts            # 3.6
│   │   ├── issues/                  # routing, roles, system-writes, partner, compliance, message (4.9)
│   │   └── config.ts                # constants and reference lists (3.3)
│   ├── lib/
│   │   ├── validation/              # zod schemas per action + lei.ts, bic.ts, phone.ts, email.ts,
│   │   │                            # vat.ts, url.ts, timezone.ts, normalise.ts (shared by client and server)
│   │   ├── dates.ts                 # today(), addDays(), businessDaysBetween(), formatDate() "02 Oct 2026"
│   │   ├── business-hours.ts        # calendars and business-hours arithmetic per team and user (4.9.3)
│   │   ├── time-zones.ts            # effective time zone, "21:12 CEST" formatting (4.9.1)
│   │   ├── labels.ts                # enum value → display label (3.3)
│   │   └── api-client.ts            # typed fetch wrapper used by client components
│   └── components/                  # ui/ (shadcn restyled), shell/, worklist/, search/, wizard/, issue/,
│                                    # entity/{header,overview,details,products,contacts,history,partner,
│                                    #         compliance,billing,audit}/, group/, handoff/, admin/
└── tests/
    ├── unit/                        # Vitest: validators, normalise, derived/*, matrix, worklist rules, issues
    └── e2e/                         # Playwright: the 4 demo scenarios, the issue flow (E2E-5) + 403 checks
```

#### 3.1.2 Layers

| Layer | Location | Does | Never does |
|---|---|---|---|
| UI | `src/app/**/page.tsx`, `src/components` | Server components render pages by calling `server/queries` with the current user. Client components hold forms and dialogs and call `lib/api-client`. Hides controls the user cannot use (M15 AC7). | Writes to the database. Decides permissions on its own. |
| Route handlers | `src/app/api/**/route.ts` | Thin: parse params, call one service function inside `handle()`, return JSON. | Contain business rules. |
| Service layer | `src/server/services` | Every write: target loading, permission check, validation, transaction, audit entries, History events, derived-field recomputation. | Render anything. |
| Query layer | `src/server/queries`, `src/server/derived` | Every read model, including computed values that are never stored: worklists (M11 AC2), billing flag (M14 AC7), KYB status (M12 AC8), effective review status, current coverage status, alerts. Applies visibility rules (soft delete, Audit tab, Partner tab). | Write. |
| Data | Prisma + PostgreSQL | Storage, constraints, append-only audit table. | |

Writes use **route handlers only** (no server actions). Reason: M9 AC4, M13 AC14, M15 AC9 and M16 AC4 require a real HTTP 403 with the JSON body `{"error":"forbidden","owner_team":"<Team>"}` when an endpoint is called directly, and the Playwright tests call these endpoints with `request.post()`. After a successful write the client calls `router.refresh()`, so worklist items, badges and banners update without a manual reload (M11 AC20, M14 AC10).

#### 3.1.3 Request flow for a write

Every write route follows the same eight steps inside `handle()` and the service function. Example: `POST /api/products/{id}/stage`.

| # | Step | Implementation | Failure response |
|---|---|---|---|
| 1 | Authenticate | `getCurrentUser()` reads the signed cookie `ch_user` (user id, HMAC-SHA256 with `SESSION_SECRET`). It loads the `User` row fresh on every request, so a team change applies to the user's next request (M15 AC5, AC10). With `DEMO_MODE=true` and no cookie, the session is the user in `DEMO_DEFAULT_USER_EMAIL`. With `DEMO_MODE=false` and no cookie the request fails (SSO is out of scope, resolution 60). | 401 `{"error":"unauthenticated"}` |
| 2 | Load target | Load the aggregate root (entity, group, handoff, user) with `deletedAt`. | 404 `{"error":"not_found"}`. Entity soft-deleted: 410 `{"error":"deleted","message":"This record was deleted. Contact the admin to reactivate it."}` (resolution 39, M9 edge 5, M10 read-only state). Only `reactivate` accepts a deleted entity. |
| 3 | Permission check | `assertCan(user, area, target)` against `permissions/matrix.ts`. For contacts the area comes from the contact's `ownerTeams`; for handoff responses it also checks "named recipient" and current team (M3 AC12, M8 AC15); for notes the author and the 24-hour window (M10 AC11); for admin actions `user.isAdmin`. Runs before body validation, so a forbidden call never reveals validation details. | 403 `{"error":"forbidden","owner_team":"Compliance"}`. `owner_team` is the display label of the owning team(s), for example `"Sales and Finance"`. Nothing is written, not even an audit entry (M15 AC9). |
| 4 | Validate | Zod schema from `lib/validation` (same schema the client form uses), then business rules (SEPA list, tier continuity, date rules, uniqueness). | 400 `{"error":"validation","fieldErrors":{"<field>":["<message>"]}}` with the exact AC copy (3.4). |
| 5 | Concurrency check | The body carries the `version` the user loaded. The service updates with `where: { id, version }` and increments `version`. | 409 `{"error":"conflict","message":"This coverage was updated by Nora Lee at 10:42. Reload to see the latest status."}`. Name and time come from the latest `AuditEntry` for that object. Messages per story: M5 edge 3, M6 edge 5, M9 edge 1, S4.9. |
| 6 | Transaction | `db.$transaction(async (tx) => { ... })`: the data change, then `recordChanges()` (one `AuditEntry` per changed field, same `actionId`), then `addHistory()` where the story asks for a History event, then derived fields (`lifecycleState`, `billableFrom`, `skippedStages`). Any throw rolls everything back, so no audit entry exists for a failed change (M16 AC1). | 500 `{"error":"server","message":"<story save-failure copy>"}` |
| 7 | Respond | 200 `{"ok":true,"data":{...}}` with the updated object and its new `version`. | |
| 8 | Refresh | Client calls `router.refresh()`. Worklists, flags and alerts are recomputed at read time; no worklist rows are written (M11 AC2). | |

Audit value formatting (`auditValue()`): dates as `02 Oct 2026` (the display format, same as 4.2.2), timestamps as ISO UTC, enums as display labels (3.3), decimals as plain strings, booleans `Yes`/`No`, arrays joined with `, `. On a create the old value is stored as `null` and rendered "(none)"; on a removal the new value is `null` and rendered "(removed)" (M16 AC2). `userName` and `userTeam` are snapshots of the acting (or "View as") user, so past entries are never rewritten (M16 edge 2, edge 5).

#### 3.1.4 Database roles

| Role | Used by | Rights |
|---|---|---|
| `hub_owner` | `prisma migrate`, `db:seed`, `db:reset`, the in-app "Reset demo data" (via `db-admin.ts`) | Owns the schema, `CREATEDB` for the Prisma shadow database |
| `hub_app` | The running app (`DATABASE_URL`) | `SELECT, INSERT, UPDATE` on all tables; `DELETE` only on `EntityAlias`, `EntityBic`, `VolumeTier`, `NoteParticipant`, `ActionItem` (rows replaced inside an edit); `SELECT, INSERT` only on `AuditEntry` (M16 AC3); no `DELETE` on `Entity` (M16 AC14) |

#### 3.1.5 Environment variables

| Variable | Example | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgresql://hub_app:hub_app@localhost:5432/customer_hub` | Runtime connection |
| `DATABASE_ADMIN_URL` | `postgresql://hub_owner:hub_owner@localhost:5432/customer_hub` | Migrations, seed, Reset demo data |
| `DEMO_MODE` | `true` | Shows "View as" and "Reset demo data"; enables auto sign-in. When `false` the reset endpoint returns 404 (M16 AC16) |
| `DEMO_DEFAULT_USER_EMAIL` | `adrian.koh@corvane.example` | Session user when no cookie is set (DEMO_MODE only). The demo starts as Adrian Koh (Ops, admin), 7.2.2 |
| `DEMO_CLOCK_START` | unset | Tests only: ISO instant where `today()` starts (7.2.1). Ignored when `NODE_ENV=production` |
| `SESSION_SECRET` | 32+ random characters | HMAC key for the `ch_user` cookie |
| `APP_TIMEZONE` | `Europe/Bucharest` | Definition of "today" and business days (Shared conventions) |
| `GLEIF_BASE_URL` | `https://api.gleif.org/api/v1` | Live GLEIF API |
| `GLEIF_TIMEOUT_MS` | `5000` | Lookup timeout (M2 error state) |
| `GLEIF_CACHE_PATH` | `data/gleif-cache.json` | Cached copy (3.5.5) |
| `GLEIF_FORCE_CACHE` | `false` | `true` skips the live call, for offline rehearsal and E2E tests |
| `GLEIF_SEED_SOURCE` | `live-with-fallback` | GLEIF values written by the seed: `live-with-fallback` (demo) or `cache` (tests), 7.1.0 |
| `APPROVED_DOC_HOSTS` | `docs.corvane-internal.example` | Comma-separated approved hosts for evidence, contract and agreement links |
| `DUPLICATE_NAME_THRESHOLD` | `0.85` | Trigram similarity threshold (M2 AC10) |

`npm` scripts: `dev`, `build`, `start`, `db:reset` (runs `scripts/db-reset.ts`: `prisma migrate reset --force --skip-seed` with `DATABASE_ADMIN_URL`, then `prisma/grants.sql`, then the seed), `db:seed`, `seed:check` (seed self-check, 7.1.14), `gleif:snapshot`, `gleif:check` (pre-demo GLEIF warnings, 7.2.5), `test` (Vitest), `test:e2e` (Playwright, runs `db:reset` first).

### 3.2 Prisma schema

#### 3.2.1 Object map

| AC object | Prisma model | Owner (M15 AC3) | Stories |
|---|---|---|---|
| Group | `Group` | Ops | M2, M4 |
| Legal entity, aliases, BICs, LEI + GLEIF status, lifecycle, soft delete | `Entity`, `EntityAlias`, `EntityBic` | Ops (Sales at creation) | M1, M2, M4, M6, M16 |
| Customer role (contract reference, renewal date, handoff summary, commercial terms) | `CustomerRole`, `VolumeTier` | Mixed: Ops, CS, Sales, Sales and Finance | M3, M4, M11 |
| Partner role (connection method, provider, partner agreement reference) | `PartnerRole` | Network; agreement reference Ops | M4, M5 |
| Partner coverage + status history + scheduled date | `PartnerCoverage`, `CoverageStatusChange` | Network | M5 |
| Contract (entity contract / group master agreement, invoiced entity) and partner agreement | `Contract` | Ops | M4, M14 |
| Contracted product (product line, contracting entity, stage, stage entry date, target go-live, block, cancelled, billable from) | `ContractedProduct` | Stages and blocks Ops; product line and target date Sales and Ops | M3, M6 |
| Stage history | `StageEvent` | Ops | M6 |
| Contact | `Contact` | By context and role (M7 AC3) | M7 |
| KYB check (4 types) | `KybCheck` | Compliance | M12 |
| Periodic review | `PeriodicReview` | Compliance | M12 |
| Obligation card (customer agreement / partner agreement) | `ObligationCard` | Compliance | M13 |
| Billing profile | `BillingProfile` | Finance | M14 |
| Handoff (Sales → Ops, Ops → CS) | `Handoff` | Sender and recipient teams | M3, M8 |
| Note + action item | `Note`, `NoteParticipant`, `ActionItem` | All teams add | M10 |
| Automatic History event | `HistoryEvent` | System | M10 |
| Owner assignment (acknowledgement) | `OwnerAssignment` | CS | M9 |
| Audit entry | `AuditEntry` | System, append-only | M16 |
| User, team change | `User`, `UserTeamChange` | Admin | M15 |
| Issue (report, type, severity, status, owner, communicator rule, clocks) | `Issue` | The issue owner (role on the issue, 4.9.12); reporter edits the description until acknowledgement | M17 to M23, M25 |
| Resolution (root cause, solution; superseded on back to work) | `IssueResolution` | The issue owner | M21 AC4, AC5, M23 AC11 |
| Group report (issues created together from a group) | `IssueGroupReport` | The reporter | M17 AC4 |
| Partner issue link (created or attached) | `IssueLink` | Owner of the partner issue | M23 |
| Contributor | `IssueContributor` | The issue owner | M18 AC8, M21 AC6 |
| Note and added report | `IssueNote` | All teams add | M17 AC6, M21 AC7 |
| Communication log entry | `IssueCommunication` | The communicator; system entries by Customer Hub | M22 |
| Compliance assessment, facts and breach clocks | `ComplianceAssessment` | Compliance | M25 |
| Root cause report task (R2) | `RootCauseReportTask` | The issue owner | M27 |
| Issue team per entity | `IssueTeamMember` | Seed only in the MVP | M18 AC3 |
| On-call rota | `OnCallShift` | Seed only in the MVP | M18 AC4, AC5 |
| Business hours per team | `TeamBusinessHours` | Seed only in the MVP | M18, M19 |
| User time zone, absence (R2) | `User.timeZone`, `User.absentUntil` | Seed; absence R2 | M18, M19, M22 |
| Regulatory block | fields on `ObligationCard` (Customer agreement only) | Compliance | M26 |

#### 3.2.2 Schema

The schema below passes `prisma validate` (Prisma 6). Copy it as `prisma/schema.prisma`. The issue flow adds the models, enums and fields of 3.2.6 in milestone 6A.

```prisma
// prisma/schema.prisma: Customer Hub
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [pg_trgm]
}

// ───────────── Enums (display labels in section 3.3) ─────────────

enum Team {
  SALES
  OPS
  CS
  NETWORK
  COMPLIANCE
  FINANCE
}

enum EntityType {
  BANK
  FINTECH
  PSP
}

enum LeiStatus {
  ISSUED
  LAPSED
  RETIRED
  MERGED
  ANNULLED
  DUPLICATE
  PENDING_TRANSFER
  PENDING_ARCHIVAL
  NOT_VERIFIED // "Not verified with GLEIF"
}

enum GleifSource {
  LIVE
  CACHE
  MANUAL
}

enum LifecycleState {
  ONBOARDING
  LIVE
  BAU
  INACTIVE
}

enum GroupDecision {
  NOT_SET
  GROUP
  STANDALONE
}

enum Scheme {
  EU_VOP
  UK_COP
  GLOBAL_VALIDATION
}

enum Stage {
  CONTRACT_SIGNED
  KICKOFF
  SANDBOX_TECHNICAL_INTEGRATION
  TESTING_CERTIFICATION
  UAT
  GO_LIVE_APPROVAL
  LIVE_HYPERCARE
  RAMP_UP
  BAU
}

enum BlockedBy {
  CUSTOMER
  Corvane
  PARTNER
}

enum StageEventKind {
  PRODUCT_ADDED
  PRODUCT_EDITED
  STAGE_FORWARD
  STAGE_SKIP
  STAGE_BACKWARD
  BLOCK_SET
  BLOCK_EDITED
  BLOCK_RESOLVED
  TARGET_DATE_CHANGED
  PRODUCT_CANCELLED
}

enum ConnectionMethod {
  DIRECT
  VIA_SCHEME
  VIA_ROUTING_PROVIDER
}

enum CoverageStatus {
  ONBOARDING
  ACTIVE
  DEGRADED
  SUSPENDED
  RETIRED
}

enum ContractKind {
  CUSTOMER_CONTRACT
  PARTNER_AGREEMENT
}

enum ContractScope {
  ENTITY_CONTRACT
  GROUP_MASTER_AGREEMENT
}

enum Currency {
  EUR
  GBP
  USD
}

enum ContactContext {
  CUSTOMER
  PARTNER
}

enum ContactRole {
  CHAMPION
  DECISION_MAKER
  TECHNICAL
  INCIDENT
  ESCALATION
  BILLING
}

enum ContactStatus {
  ACTIVE
  LEFT
}

enum KybCheckType {
  LICENCE
  LEI
  OWNERSHIP_STRUCTURE
  SANCTIONS_SCREENING
}

enum SanctionsResult {
  NO_MATCH
  POTENTIAL_MATCH_UNDER_REVIEW
  CONFIRMED_MATCH
}

enum ReviewStatus {
  PLANNED
  IN_PROGRESS
  COMPLETED
  OVERDUE // never written by a user; derived at read time (M12 AC12)
}

enum ObligationCardKind {
  CUSTOMER_AGREEMENT
  PARTNER_AGREEMENT
}

enum SchemeAdherence {
  NOT_APPLICABLE
  NOT_STARTED
  IN_PROGRESS
  ADHERED
  SUSPENDED
  WITHDRAWN
}

enum HandoffType {
  SALES_TO_OPS
  OPS_TO_CS
}

enum HandoffStatus {
  SENT
  CONFIRMED
  ACCEPTED
  DECLINED
  CANCELLED
}

enum NoteType {
  CALL
  QBR
  NEGOTIATION
  INCIDENT
  PAYMENT
  OTHER
}

enum ParticipantKind {
  USER
  CONTACT
  FREE_TEXT
}

enum ActionItemStatus {
  OPEN
  DONE
}

enum HistoryCategory {
  STAGE_CHANGE
  CONTACT_CHANGE
  HANDOFF
  OWNER_REASSIGNED
  NETWORK_AND_STRUCTURE
  OTHER_FIELD_CHANGES
}

enum AuditObjectType {
  LEGAL_ENTITY
  GROUP
  CUSTOMER_ROLE
  PARTNER_ROLE
  COVERAGE_ROW
  CONTRACT
  CONTRACTED_PRODUCT
  CONTACT
  KYB_CHECK
  PERIODIC_REVIEW
  OBLIGATIONS
  BILLING_PROFILE
  HANDOFF
  NOTE
  ACTION_ITEM
  OWNER_ASSIGNMENT
  USER
}

enum AuditSource {
  USER
  SYSTEM_GLEIF
}

enum UserChangeKind {
  USER_ADDED
  TEAM_CHANGED
}

// ───────────── Users ─────────────

model User {
  id        String   @id @default(cuid())
  name      String   @db.VarChar(120)
  email     String   @unique @db.VarChar(254) // stored lowercase
  team      Team
  isAdmin   Boolean  @default(false)
  active    Boolean  @default(true) // no inactive users in the seed (resolution 6)
  createdAt DateTime @default(now()) @db.Timestamptz(3)

  ownedEntities          Entity[]               @relation("EntityOwner")
  createdEntities        Entity[]               @relation("EntityCreatedBy")
  deletedEntities        Entity[]               @relation("EntityDeletedBy")
  createdCustomerRoles   CustomerRole[]         @relation("CustomerRoleCreatedBy")
  stageEvents            StageEvent[]           @relation("StageEventUser")
  coverageChanges        CoverageStatusChange[] @relation("CoverageChangeUser")
  verifiedContacts       Contact[]              @relation("ContactVerifiedBy")
  verifiedKybChecks      KybCheck[]             @relation("KybVerifiedBy")
  updatedObligationCards ObligationCard[]       @relation("ObligationUpdatedBy")
  handoffsSent           Handoff[]              @relation("HandoffFrom")
  handoffsReceived       Handoff[]              @relation("HandoffTo")
  handoffsCancelled      Handoff[]              @relation("HandoffCancelledBy")
  notes                  Note[]                 @relation("NoteAuthor")
  noteParticipations     NoteParticipant[]      @relation("NoteParticipantUser")
  actionItemsOwned       ActionItem[]           @relation("ActionItemOwner")
  actionItemsToggled     ActionItem[]           @relation("ActionItemStatusChangedBy")
  historyEvents          HistoryEvent[]         @relation("HistoryActor")
  assignmentsReceived    OwnerAssignment[]      @relation("AssignmentAssignee")
  assignmentsMade        OwnerAssignment[]      @relation("AssignmentAssignedBy")
  assignmentsLost        OwnerAssignment[]      @relation("AssignmentPreviousOwner")
  auditEntries           AuditEntry[]           @relation("AuditUser")
  teamChanges            UserTeamChange[]       @relation("TeamChangeUser")
  teamChangesMade        UserTeamChange[]       @relation("TeamChangeChangedBy")

  @@index([team, active])
}

model UserTeamChange {
  id          String         @id @default(cuid())
  userId      String
  user        User           @relation("TeamChangeUser", fields: [userId], references: [id])
  kind        UserChangeKind
  oldTeam     Team? // null for USER_ADDED
  newTeam     Team
  changedById String
  changedBy   User           @relation("TeamChangeChangedBy", fields: [changedById], references: [id])
  changedAt   DateTime       @default(now()) @db.Timestamptz(3)

  @@index([changedAt(sort: Desc)])
}

// ───────────── Groups and entities ─────────────

model Group {
  id                   String       @id @default(cuid())
  name                 String       @db.VarChar(200)
  nameNormalized       String       @unique @db.VarChar(200) // M4 AC6 uniqueness
  parentLei            String?      @db.Char(20)
  parentLegalName      String?      @db.VarChar(200)
  parentLeiStatus      LeiStatus? // NOT_VERIFIED when GLEIF was unreachable
  parentGleifCheckedAt DateTime?    @db.Timestamptz(3)
  hqCountry            String       @db.Char(2)
  version              Int          @default(0)
  createdAt            DateTime     @default(now()) @db.Timestamptz(3)
  updatedAt            DateTime     @updatedAt @db.Timestamptz(3)
  entities             Entity[]
  contracts            Contract[]
  auditEntries         AuditEntry[]

  @@index([parentLei])
}

model Entity {
  id              String      @id @default(cuid())
  legalName       String      @db.VarChar(200)
  legalNameSearch String      @db.VarChar(200) // normalised, legal forms kept (3.7)
  legalNameCore   String      @db.VarChar(200) // normalised, legal forms removed (3.6)
  type            EntityType? // nullable only for legacy seed rows (M11 AC9)
  country         String?     @db.Char(2)
  lei             String?     @db.Char(20) // not unique: duplicates are warned, never blocked (M2 AC12, M16 AC15)

  // GLEIF snapshot of the entity LEI (M2 AC5, AC7, M12 AC3)
  leiStatus               LeiStatus?
  gleifRawStatus          String?      @db.VarChar(40)
  leiNextRenewalDate      DateTime?    @db.Date
  gleifCheckedAt          DateTime?    @db.Timestamptz(3)
  gleifSource             GleifSource?
  gleifLegalName          String?      @db.VarChar(300)
  gleifCountry            String?      @db.Char(2)
  gleifDirectParentLei    String?      @db.Char(20)
  gleifDirectParentName   String?      @db.VarChar(300)
  gleifUltimateParentLei  String?      @db.Char(20)
  gleifUltimateParentName String?      @db.VarChar(300)
  gleifSuccessorLei       String?      @db.Char(20)

  groupId       String?
  group         Group?        @relation(fields: [groupId], references: [id])
  groupDecision GroupDecision @default(NOT_SET) // "Group not set" when NOT_SET (M4 AC15)

  lifecycleState LifecycleState @default(ONBOARDING) // recomputed in every product, coverage and role write (M6 AC12, decision B1)
  inactiveReason String?        @db.VarChar(500)

  ownerId    String?
  owner      User?     @relation("EntityOwner", fields: [ownerId], references: [id])
  ownerSince DateTime? @db.Timestamptz(3)

  createdById String?
  createdBy   User?   @relation("EntityCreatedBy", fields: [createdById], references: [id])

  deletedAt    DateTime? @db.Timestamptz(3)
  deletedById  String?
  deletedBy    User?     @relation("EntityDeletedBy", fields: [deletedById], references: [id])
  deleteReason String?   @db.VarChar(500)

  version   Int      @default(0)
  createdAt DateTime @default(now()) @db.Timestamptz(3)
  updatedAt DateTime @updatedAt @db.Timestamptz(3)

  aliases           EntityAlias[]
  bics              EntityBic[]
  customerRole      CustomerRole?
  partnerRole       PartnerRole?
  products          ContractedProduct[] @relation("ProductCustomerEntity")
  contractingFor    ContractedProduct[] @relation("ProductContractingEntity")
  contractsHeld     Contract[]          @relation("ContractHolderEntity")
  contractsInvoiced Contract[]          @relation("ContractInvoicedEntity")
  contacts          Contact[]
  kybChecks         KybCheck[]
  periodicReview    PeriodicReview?
  obligationCards   ObligationCard[]
  billingProfile    BillingProfile?
  handoffs          Handoff[]
  notes             Note[]
  historyEvents     HistoryEvent[]
  ownerAssignments  OwnerAssignment[]
  auditEntries      AuditEntry[]

  @@index([lei])
  @@index([lei(ops: raw("bpchar_pattern_ops"))], map: "Entity_lei_prefix_idx")
  @@index([legalNameSearch(ops: raw("gin_trgm_ops"))], type: Gin, map: "Entity_legalNameSearch_trgm_idx")
  @@index([legalNameCore(ops: raw("gin_trgm_ops"))], type: Gin, map: "Entity_legalNameCore_trgm_idx")
  @@index([legalNameCore])
  @@index([groupId])
  @@index([ownerId])
  @@index([createdById])
  @@index([deletedAt])
  @@index([lifecycleState])
  @@index([country])
}

model EntityAlias {
  id          String @id @default(cuid())
  entityId    String
  entity      Entity @relation(fields: [entityId], references: [id])
  alias       String @db.VarChar(100)
  aliasSearch String @db.VarChar(100)
  aliasCore   String @db.VarChar(100)

  @@unique([entityId, aliasSearch])
  @@index([aliasSearch(ops: raw("gin_trgm_ops"))], type: Gin, map: "EntityAlias_aliasSearch_trgm_idx")
  @@index([aliasCore(ops: raw("gin_trgm_ops"))], type: Gin, map: "EntityAlias_aliasCore_trgm_idx")
  @@index([aliasCore])
}

model EntityBic {
  id       String @id @default(cuid())
  entityId String
  entity   Entity @relation(fields: [entityId], references: [id])
  bic      String @db.VarChar(11) // uppercase, 8 or 11
  bic8     String @db.Char(8)

  @@unique([entityId, bic])
  @@index([bic8])
  @@index([bic])
}

// ───────────── Roles and contracts ─────────────

model CustomerRole {
  id          String  @id @default(cuid())
  entityId    String  @unique
  entity      Entity  @relation(fields: [entityId], references: [id])
  active      Boolean @default(true) // false = role removed, data kept (M4 AC8)
  createdById String? // Sales user who added the role; scopes Sales worklists (M11 AC3)
  createdBy   User?   @relation("CustomerRoleCreatedBy", fields: [createdById], references: [id])

  // Applicable contract (Ops, M4 AC9-AC10, D1)
  contractId String?
  contract   Contract? @relation("CustomerRoleContract", fields: [contractId], references: [id])

  // Renewal date (CS)
  renewalDate DateTime? @db.Date

  // Handoff summary (Sales, M3 AC4, AC6, AC7, AC9)
  slaAvailabilityPct  Decimal? @db.Decimal(5, 2)
  slaMaxResponseMs    Int?
  slaOther            String?  @db.VarChar(1000)
  specialTerms        String?  @db.VarChar(2000)
  entitiesNotInPortal String?  @db.VarChar(1000)
  notesForOnboarding  String?  @db.VarChar(2000)

  // Commercial terms (Sales and Finance, M3 AC5, D3)
  currency             Currency?
  pricePerVerification Decimal?     @db.Decimal(12, 4)
  monthlyMinimum       Decimal?     @db.Decimal(14, 2)
  paymentTermDays      Int?
  volumeTiers          VolumeTier[]

  version   Int      @default(0)
  createdAt DateTime @default(now()) @db.Timestamptz(3)
  updatedAt DateTime @updatedAt @db.Timestamptz(3)

  @@index([contractId])
  @@index([renewalDate])
}

model VolumeTier {
  id                   String       @id @default(cuid())
  customerRoleId       String
  customerRole         CustomerRole @relation(fields: [customerRoleId], references: [id], onDelete: Cascade)
  position             Int
  fromVolume           Int
  toVolume             Int? // empty on the last tier only
  pricePerVerification Decimal      @db.Decimal(12, 4)

  @@unique([customerRoleId, position])
}

model PartnerRole {
  id                 String            @id @default(cuid())
  entityId           String            @unique
  entity             Entity            @relation(fields: [entityId], references: [id])
  active             Boolean           @default(true)
  connectionMethod   ConnectionMethod?
  providerName       String?           @db.VarChar(120)
  partnerAgreementId String?
  partnerAgreement   Contract?         @relation("PartnerRoleAgreement", fields: [partnerAgreementId], references: [id])
  coverage           PartnerCoverage[]
  version            Int               @default(0)
  createdAt          DateTime          @default(now()) @db.Timestamptz(3)
  updatedAt          DateTime          @updatedAt @db.Timestamptz(3)
}

model PartnerCoverage {
  id            String                 @id @default(cuid())
  partnerRoleId String
  partnerRole   PartnerRole            @relation(fields: [partnerRoleId], references: [id])
  country       String                 @db.Char(2)
  scheme        Scheme
  statusChanges CoverageStatusChange[] // current and scheduled status are derived from this list (3.2 notes)
  version       Int                    @default(0)
  createdAt     DateTime               @default(now()) @db.Timestamptz(3)

  @@unique([partnerRoleId, country, scheme]) // M5 AC5
  @@index([country, scheme])
}

model CoverageStatusChange {
  id            String          @id @default(cuid())
  coverageId    String
  coverage      PartnerCoverage @relation(fields: [coverageId], references: [id])
  status        CoverageStatus
  effectiveDate DateTime        @db.Date // up to today + 30 (M5 AC17)
  reason        String          @db.VarChar(500)
  userId        String
  user          User            @relation("CoverageChangeUser", fields: [userId], references: [id])
  createdAt     DateTime        @default(now()) @db.Timestamptz(3)

  @@index([coverageId, effectiveDate(sort: Desc), createdAt(sort: Desc)])
}

model Contract {
  id               String         @id @default(cuid())
  contractId       String         @unique @db.VarChar(50) // e.g. IPE-MSA-2026-014, matched case-insensitively
  kind             ContractKind
  title            String         @db.VarChar(200)
  signingDate      DateTime       @db.Date
  scope            ContractScope
  documentUrl      String         @db.VarChar(2048)
  groupId          String? // set for GROUP_MASTER_AGREEMENT
  group            Group?         @relation(fields: [groupId], references: [id])
  holderEntityId   String // entity it was first attached to; search target for ENTITY_CONTRACT (M1 AC18)
  holderEntity     Entity         @relation("ContractHolderEntity", fields: [holderEntityId], references: [id])
  invoicedEntityId String? // customer contracts only (M4 AC9); null for partner agreements (M4 AC11)
  invoicedEntity   Entity?        @relation("ContractInvoicedEntity", fields: [invoicedEntityId], references: [id])
  customerRoles    CustomerRole[] @relation("CustomerRoleContract")
  partnerRoles     PartnerRole[]  @relation("PartnerRoleAgreement")
  version          Int            @default(0)
  createdAt        DateTime       @default(now()) @db.Timestamptz(3)
  updatedAt        DateTime       @updatedAt @db.Timestamptz(3)

  @@index([groupId])
  @@index([contractId(ops: raw("varchar_pattern_ops"))], map: "Contract_contractId_prefix_idx")
}

// ───────────── Products and stages ─────────────

model ContractedProduct {
  id                  String    @id @default(cuid())
  entityId            String // the customer record that holds the band (M6 AC21)
  entity              Entity    @relation("ProductCustomerEntity", fields: [entityId], references: [id])
  contractingEntityId String
  contractingEntity   Entity    @relation("ProductContractingEntity", fields: [contractingEntityId], references: [id])
  product             Scheme
  country             String    @db.Char(2)
  stage               Stage     @default(CONTRACT_SIGNED)
  stageEnteredAt      DateTime  @db.Date
  skippedStages       Stage[] // stages shown as "Skipped" on the band (M6 AC5)
  targetGoLive        DateTime  @db.Date
  billableFrom        DateTime? @db.Date // entry date of Live & hypercare (M6 AC11)

  // Open block (M6 AC7-AC9). Closed blocks live in StageEvent.
  blockedBy     BlockedBy?
  blockedReason String?    @db.VarChar(500)
  blockedSince  DateTime?  @db.Date

  cancelledAt  DateTime? @db.Date
  cancelReason String?   @db.VarChar(500)

  stageEvents StageEvent[]
  version     Int          @default(0)
  createdAt   DateTime     @default(now()) @db.Timestamptz(3)
  updatedAt   DateTime     @updatedAt @db.Timestamptz(3)

  @@unique([entityId, product, country, contractingEntityId]) // M3 AC2
  @@index([contractingEntityId])
  @@index([stage, stageEnteredAt])
  @@index([targetGoLive])
  @@index([blockedSince])
  @@index([country, product, stage])
}

model StageEvent {
  id              String            @id @default(cuid())
  productId       String
  product         ContractedProduct @relation(fields: [productId], references: [id])
  kind            StageEventKind
  fromStage       Stage?
  toStage         Stage?
  entryDate       DateTime?         @db.Date
  skippedStages   Stage[]
  note            String?           @db.VarChar(500)
  reason          String?           @db.VarChar(500)
  blockedBy       BlockedBy?
  blockDays       Int? // set on BLOCK_RESOLVED (M6 AC8)
  oldTargetGoLive DateTime?         @db.Date
  newTargetGoLive DateTime?         @db.Date
  userId          String
  user            User              @relation("StageEventUser", fields: [userId], references: [id])
  createdAt       DateTime          @default(now()) @db.Timestamptz(3)

  @@index([productId, createdAt])
}

// ───────────── Contacts ─────────────

model Contact {
  id                String            @id @default(cuid())
  entityId          String
  entity            Entity            @relation(fields: [entityId], references: [id])
  context           ContactContext
  role              ContactRole
  ownerTeams        Team[] // set from (context, role) on create and on role change only (M15 AC4, edge cases 3-4)
  fullName          String            @db.VarChar(120)
  email             String            @db.VarChar(254) // lowercase
  phone             String?           @db.VarChar(16) // E.164
  timeZone          String?           @db.VarChar(64) // IANA
  available24x7     Boolean           @default(false)
  availabilityDays  Int[] // ISO weekday 1 = Monday ... 7 = Sunday
  availabilityStart String?           @db.Char(5) // "HH:MM"
  availabilityEnd   String?           @db.Char(5) // may be earlier than start: crosses midnight (M7 edge 2)
  jobTitle          String?           @db.VarChar(120)
  status            ContactStatus     @default(ACTIVE)
  leftOn            DateTime?         @db.Date
  leftNote          String?           @db.VarChar(500)
  isPrimary         Boolean           @default(false) // Incident contacts only (M7 AC9)
  lastVerifiedAt    DateTime?         @db.Date
  lastVerifiedById  String?
  lastVerifiedBy    User?             @relation("ContactVerifiedBy", fields: [lastVerifiedById], references: [id])
  participations    NoteParticipant[]
  version           Int               @default(0)
  createdAt         DateTime          @default(now()) @db.Timestamptz(3)
  updatedAt         DateTime          @updatedAt @db.Timestamptz(3)

  @@index([entityId, context, role, status])
  @@index([entityId, email])
  @@index([role, status, lastVerifiedAt])
}

// ───────────── Compliance ─────────────

model KybCheck {
  id               String           @id @default(cuid())
  entityId         String
  entity           Entity           @relation(fields: [entityId], references: [id])
  type             KybCheckType
  // Licence (M12 AC2)
  licenceNumber    String?          @db.VarChar(50)
  issuingAuthority String?          @db.VarChar(120)
  expiryDate       DateTime?        @db.Date // Licence only; LEI expiry = Entity.leiNextRenewalDate
  noExpiry         Boolean          @default(false)
  // Ownership structure (M12 AC4)
  ownershipSummary String?          @db.VarChar(2000)
  parentEntityName String?          @db.VarChar(200)
  // Sanctions screening (M12 AC5)
  sanctionsResult  SanctionsResult?
  sanctionsLists   String?          @db.VarChar(200)
  // Verification metadata (M12 AC6)
  verifiedById     String?
  verifiedBy       User?            @relation("KybVerifiedBy", fields: [verifiedById], references: [id])
  verifiedOn       DateTime?        @db.Date
  evidenceUrl      String?          @db.VarChar(2048)
  version          Int              @default(0)
  updatedAt        DateTime         @updatedAt @db.Timestamptz(3)

  @@unique([entityId, type])
  @@index([type, expiryDate])
}

model PeriodicReview {
  id             String       @id @default(cuid())
  entityId       String       @unique
  entity         Entity       @relation(fields: [entityId], references: [id])
  status         ReviewStatus // stored values: PLANNED or IN_PROGRESS
  pastDue        Boolean      @default(false) // "Past due" marker (M12 AC12)
  lastReviewDate DateTime?    @db.Date
  nextReviewDate DateTime     @db.Date
  version        Int          @default(0)
  updatedAt      DateTime     @updatedAt @db.Timestamptz(3)

  @@index([nextReviewDate])
}

model ObligationCard {
  id                     String             @id @default(cuid())
  entityId               String
  entity                 Entity             @relation(fields: [entityId], references: [id])
  kind                   ObligationCardKind
  incidentNoticeHours    Int?
  subprocessorNoticeDays Int?
  auditRight             Boolean?
  availabilitySlaPct     Decimal?           @db.Decimal(5, 2)
  euVopStatus            SchemeAdherence?
  ukCopStatus            SchemeAdherence?
  expiryDate             DateTime?          @db.Date
  contractUrl            String?            @db.VarChar(2048)
  updatedById            String?
  updatedBy              User?              @relation("ObligationUpdatedBy", fields: [updatedById], references: [id])
  version                Int                @default(0)
  updatedAt              DateTime           @updatedAt @db.Timestamptz(3)

  @@unique([entityId, kind])
  @@index([subprocessorNoticeDays])
  @@index([incidentNoticeHours])
}

// ───────────── Billing ─────────────

model BillingProfile {
  id                    String   @id @default(cuid())
  entityId              String   @unique
  entity                Entity   @relation(fields: [entityId], references: [id])
  billingLegalName      String?  @db.VarChar(200)
  street                String?  @db.VarChar(200)
  city                  String?  @db.VarChar(100)
  postalCode            String?  @db.VarChar(20)
  country               String?  @db.Char(2)
  vatId                 String?  @db.VarChar(40) // stored stripped and uppercase
  lei                   String?  @db.VarChar(20)
  contractingEntity String?  @db.VarChar(100) // free string so removed options survive (M14 edge 5)
  version               Int      @default(0)
  createdAt             DateTime @default(now()) @db.Timestamptz(3)
  updatedAt             DateTime @updatedAt @db.Timestamptz(3)
  // "Incomplete for billing" is computed at read time and never stored (M14 AC7)
}

// ───────────── Handoffs ─────────────

model Handoff {
  id                String         @id @default(cuid())
  entityId          String
  entity            Entity         @relation(fields: [entityId], references: [id])
  type              HandoffType
  status            HandoffStatus  @default(SENT)
  fromUserId        String
  fromUser          User           @relation("HandoffFrom", fields: [fromUserId], references: [id])
  toUserId          String
  toUser            User           @relation("HandoffTo", fields: [toUserId], references: [id])
  snapshot          Json // SalesToOpsSnapshot or OpsToCsSnapshot (3.2 notes)
  sentAt            DateTime       @db.Timestamptz(3)
  confirmedAt       DateTime?      @db.Timestamptz(3) // Sales → Ops
  acceptedAt        DateTime?      @db.Timestamptz(3) // Ops → CS
  declinedAt        DateTime?      @db.Timestamptz(3)
  declineReason     String?        @db.VarChar(500)
  cancelledAt       DateTime?      @db.Timestamptz(3)
  cancelledById     String?
  cancelledBy       User?          @relation("HandoffCancelledBy", fields: [cancelledById], references: [id])
  cancelReason      String?        @db.VarChar(500)
  previousHandoffId String? // resend after decline (resolution 35)
  version           Int            @default(0)
  createdAt         DateTime       @default(now()) @db.Timestamptz(3)
  historyEvents     HistoryEvent[]

  @@index([toUserId, status])
  @@index([fromUserId, type, status])
  @@index([entityId, type, status])
}

// ───────────── History, owner, audit ─────────────

model Note {
  id              String            @id @default(cuid())
  entityId        String
  entity          Entity            @relation(fields: [entityId], references: [id])
  type            NoteType
  interactionDate DateTime          @db.Date
  summary         String            @db.VarChar(5000)
  authorId        String
  author          User              @relation("NoteAuthor", fields: [authorId], references: [id])
  authorTeam      Team // team at creation time
  editedAt        DateTime?         @db.Timestamptz(3)
  createdAt       DateTime          @default(now()) @db.Timestamptz(3)
  participants    NoteParticipant[]
  actionItems     ActionItem[]

  @@index([entityId, createdAt(sort: Desc)])
}

model NoteParticipant {
  id           String          @id @default(cuid())
  noteId       String
  note         Note            @relation(fields: [noteId], references: [id], onDelete: Cascade)
  kind         ParticipantKind
  userId       String?
  user         User?           @relation("NoteParticipantUser", fields: [userId], references: [id])
  contactId    String?
  contact      Contact?        @relation(fields: [contactId], references: [id])
  nameSnapshot String          @db.VarChar(120) // name as at save time (M10 edge 3)

  @@index([noteId])
}

model ActionItem {
  id                String           @id @default(cuid())
  noteId            String
  note              Note             @relation(fields: [noteId], references: [id], onDelete: Cascade)
  position          Int
  description       String           @db.VarChar(300)
  ownerId           String
  owner             User             @relation("ActionItemOwner", fields: [ownerId], references: [id])
  dueDate           DateTime         @db.Date
  status            ActionItemStatus @default(OPEN)
  statusChangedById String?
  statusChangedBy   User?            @relation("ActionItemStatusChangedBy", fields: [statusChangedById], references: [id])
  statusChangedAt   DateTime?        @db.Timestamptz(3)

  @@unique([noteId, position])
  @@index([ownerId, status])
}

model HistoryEvent {
  id        String          @id @default(cuid())
  entityId  String
  entity    Entity          @relation(fields: [entityId], references: [id])
  category  HistoryCategory
  summary   String          @db.VarChar(1000) // rendered sentence, e.g. "EU VoP / DE: UAT → Go-live approval (entered 01 Oct 2026). By Adrian Koh, Ops"
  details   Json? // [{ field, old, new }] shown inline to non-Compliance teams (M10 AC5)
  actionId  String // links to the AuditEntry rows of the same write (audit link for Compliance and the admin)
  handoffId String?
  handoff   Handoff?        @relation(fields: [handoffId], references: [id])
  actorId   String?
  actor     User?           @relation("HistoryActor", fields: [actorId], references: [id])
  actorName String          @db.VarChar(120)
  actorTeam Team?
  createdAt DateTime        @default(now()) @db.Timestamptz(3)

  @@index([entityId, createdAt(sort: Desc)])
  @@index([entityId, category])
}

model OwnerAssignment {
  id              String    @id @default(cuid())
  entityId        String
  entity          Entity    @relation(fields: [entityId], references: [id])
  assigneeId      String
  assignee        User      @relation("AssignmentAssignee", fields: [assigneeId], references: [id])
  assignedById    String
  assignedBy      User      @relation("AssignmentAssignedBy", fields: [assignedById], references: [id])
  previousOwnerId String?
  previousOwner   User?     @relation("AssignmentPreviousOwner", fields: [previousOwnerId], references: [id])
  reason          String    @db.VarChar(500)
  assignedAt      DateTime  @default(now()) @db.Timestamptz(3)
  acknowledgedAt  DateTime? @db.Timestamptz(3)
  supersededAt    DateTime? @db.Timestamptz(3) // set when the entity is reassigned again before acknowledgement (M9 AC11)

  @@index([assigneeId, acknowledgedAt, supersededAt])
  @@index([entityId])
}

model AuditEntry {
  id          BigInt          @id @default(autoincrement())
  actionId    String // one id per write; groups the per-field rows
  entityId    String?
  entity      Entity?         @relation(fields: [entityId], references: [id])
  groupId     String?
  group       Group?          @relation(fields: [groupId], references: [id])
  objectType  AuditObjectType
  objectId    String
  objectLabel String          @db.VarChar(300) // e.g. "Contact: Priya Nair (Incident)"
  field       String          @db.VarChar(120) // display label, e.g. "Expiry date"
  oldValue    String? // null renders "(none)"
  newValue    String? // null on removal renders "(removed)"
  reason      String?         @db.VarChar(2000)
  source      AuditSource     @default(USER)
  userId      String?
  user        User?           @relation("AuditUser", fields: [userId], references: [id])
  userName    String          @db.VarChar(120) // snapshot
  userTeam    Team // team at the time of the change (M16 edge 5)
  createdAt   DateTime        @default(now()) @db.Timestamptz(3)

  @@index([entityId, createdAt(sort: Desc)])
  @@index([entityId, field])
  @@index([entityId, userId])
  @@index([objectType, objectId, createdAt(sort: Desc)])
  @@index([actionId])
}

// ───────────── Demo mode ─────────────

model DemoMeta {
  id          Int @id @default(1) // single row
  seedVersion Int @default(0)     // incremented by Reset demo data; compared with the ch_seed cookie (7.2.3)
}
```

#### 3.2.3 Hand-written SQL

`prisma/migrations/0002_constraints/migration.sql` (create with `prisma migrate dev --create-only`, then paste):

```sql
-- One open handoff of each type per entity (M8 AC2, M3 AC13)
CREATE UNIQUE INDEX "Handoff_one_open_ops_to_cs"
  ON "Handoff" ("entityId") WHERE "type" = 'OPS_TO_CS' AND "status" = 'SENT';
CREATE UNIQUE INDEX "Handoff_one_open_sales_to_ops"
  ON "Handoff" ("entityId") WHERE "type" = 'SALES_TO_OPS' AND "status" = 'SENT';

-- At most one Primary active Incident contact per entity and context (M7 AC9)
CREATE UNIQUE INDEX "Contact_one_primary_incident"
  ON "Contact" ("entityId", "context")
  WHERE "isPrimary" AND "role" = 'INCIDENT' AND "status" = 'ACTIVE';

-- Audit entries are append-only for every role (M16 AC3). Reset demo data uses TRUNCATE, which row triggers do not block.
CREATE FUNCTION audit_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'AuditEntry is append-only';
END $$;
CREATE TRIGGER "AuditEntry_append_only"
  BEFORE UPDATE OR DELETE ON "AuditEntry"
  FOR EACH ROW EXECUTE FUNCTION audit_append_only();

-- Range checks that mirror the Zod rules (3.4)
ALTER TABLE "ObligationCard"
  ADD CONSTRAINT "ObligationCard_incident_range" CHECK ("incidentNoticeHours" IS NULL OR "incidentNoticeHours" BETWEEN 1 AND 720),
  ADD CONSTRAINT "ObligationCard_subprocessor_range" CHECK ("subprocessorNoticeDays" IS NULL OR "subprocessorNoticeDays" BETWEEN 0 AND 365),
  ADD CONSTRAINT "ObligationCard_sla_range" CHECK ("availabilitySlaPct" IS NULL OR "availabilitySlaPct" BETWEEN 90 AND 100);
ALTER TABLE "CustomerRole"
  ADD CONSTRAINT "CustomerRole_payment_term_range" CHECK ("paymentTermDays" IS NULL OR "paymentTermDays" BETWEEN 1 AND 180),
  ADD CONSTRAINT "CustomerRole_price_positive" CHECK ("pricePerVerification" IS NULL OR "pricePerVerification" > 0),
  ADD CONSTRAINT "CustomerRole_sla_range" CHECK ("slaAvailabilityPct" IS NULL OR "slaAvailabilityPct" BETWEEN 90 AND 100);
```

`prisma/grants.sql` (run by `db:reset` after migrations, as `hub_owner`):

```sql
GRANT USAGE ON SCHEMA public TO hub_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO hub_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO hub_app;
GRANT DELETE ON "EntityAlias", "EntityBic", "VolumeTier", "NoteParticipant", "ActionItem" TO hub_app;
REVOKE UPDATE ON "AuditEntry" FROM hub_app;   -- SELECT and INSERT only (M16 AC3)
```

`docker/initdb/01-roles.sql`:

```sql
CREATE ROLE hub_owner LOGIN PASSWORD 'hub_owner' CREATEDB;
CREATE ROLE hub_app LOGIN PASSWORD 'hub_app';
CREATE DATABASE customer_hub OWNER hub_owner;
```

#### 3.2.4 Modelling rules the schema relies on

| Topic | Rule |
|---|---|
| Role presence | An entity "has the Customer role" when `customerRole.active = true`, and "has the Network partner role" when `partnerRole.active = true`. Removing a role sets `active = false` and keeps all child data; re-adding sets it back (M4 AC8, M5 edge 4, M13 edge 3). Every non-deleted entity keeps at least one active role (M4 AC7). |
| Group decision | `groupDecision = GROUP` when `groupId` is set, `STANDALONE` when the user chose "Standalone entity", `NOT_SET` otherwise ("Group not set" on the Ops worklist, M4 AC15, M11 AC9). Unlink sets `STANDALONE` (M4 AC5). |
| Lifecycle state | Stored for search and filtering, recomputed by `derived/lifecycle.ts` in the same transaction as every product add, stage change and cancel: considering only lines with `cancelledAt = null`, `LIVE` when any line is at `LIVE_HYPERCARE` or later, `BAU` when every line is at `BAU` (at least one line), otherwise `ONBOARDING`. Partner-only entities (active Partner role, no active Customer role) follow decision B1: `LIVE` when at least one coverage row's current status is `ACTIVE` or `DEGRADED`, otherwise `ONBOARDING`; the recomputation also runs on every coverage add, coverage status change and role change. While `lifecycleState = INACTIVE` the recomputation is skipped; "Mark as active" runs it (M6 AC12, S4.9). |
| Billable from | Set to the entry date when a line moves from a stage before `LIVE_HYPERCARE` to `LIVE_HYPERCARE` or later; cleared when it moves from `LIVE_HYPERCARE` or later back before it (M6 AC11). |
| Skipped stages | A skip from N to M stores stages N+1 .. M-1 in `skippedStages`. A backward move to stage K removes every skipped stage after K (they return to future style, M6 AC6). |
| Open block | `blockedBy`, `blockedReason`, `blockedSince` hold the open block. Resolving clears them and writes `StageEvent(kind = BLOCK_RESOLVED, blockDays)`. A stage change keeps the block unless "Resolve block" is ticked (M6 AC9). |
| Coverage status | `CoverageStatusChange` is the only store. Current status of a row = the change with the latest `effectiveDate <= today`, ties broken by latest `createdAt`. Scheduled status = the earliest change with `effectiveDate > today` ("Scheduled: <status> from <date>"). A row whose only change is in the future has no current status and is excluded from alerts, search and Overview counts until that date (M5 AC17). No job is needed: the scheduled status becomes current by date. |
| Review status | Stored `status` is `PLANNED` or `IN_PROGRESS`. Effective status = `OVERDUE` when stored status is `PLANNED` or `IN_PROGRESS` and `nextReviewDate < today`. "Complete review" writes `lastReviewDate = completion date`, `nextReviewDate = new date`, `status = PLANNED`, `pastDue = false`. Moving an effectively Overdue review to `IN_PROGRESS` sets `pastDue = true` (M12 AC12). |
| KYB status | Computed (M12 AC8): `NOT_STARTED` when `verifiedOn` is null; `EXPIRED` when expiry < today, or (LEI check) entity `leiStatus` in LAPSED, RETIRED, MERGED, ANNULLED, DUPLICATE, or `gleifRawStatus = 'NOT_FOUND'`; `EXPIRING` when expiry is today to today + 90; otherwise `VERIFIED`. Licence expiry = `KybCheck.expiryDate` (none when `noExpiry`); LEI expiry = `Entity.leiNextRenewalDate`; Ownership and Sanctions have no expiry. An entity with no LEI shows the LEI card as `NOT_STARTED` (M12 edge 1). |
| Billing flag | Computed at read time, never stored (M14 AC7). Applies only when the Customer role is active, lifecycle is not `INACTIVE`, the entity is not deleted, and the applicable contract's `invoicedEntityId` is the entity itself or there is no contract. When the contract names another entity, the Billing tab shows "Billed through <entity>" and no flag (M14 AC15). |
| Contract sharing | `CustomerRole.contractId` points at one `Contract`. A group master agreement is one `Contract` row (`scope = GROUP_MASTER_AGREEMENT`, `groupId` set) referenced by several customer roles: "Applies to n entities" = count of active customer roles that reference it (M4 AC10). `invoicedEntityId` lives on the contract, so it is the same for every entity using it (M4 edge 4). Partner agreements are `Contract` rows with `kind = PARTNER_AGREEMENT`, `scope = ENTITY_CONTRACT`, `invoicedEntityId = null` (M4 AC11). |
| Contact ownership | `ownerTeams` is set from `(context, role)` at create and at role or context change only: Customer + Champion or Decision maker → `[SALES, CS]`; Customer + Technical, Incident or Escalation → `[OPS]`; Partner + any role except Billing → `[NETWORK]`; Billing in either context → `[FINANCE]`. Edit rights follow `ownerTeams` (M7 AC3, M15 AC4, edge 3, edge 4). |
| Owner | `ownerId` and `ownerSince` change on: wizard submit (Sales creator), Sales → Ops confirm, Ops → CS accept, M9 reassignment. Only M9 reassignments to someone other than the actor create an `OwnerAssignment` row (M9 AC9, edge 4). A new reassignment sets `supersededAt` on the previous unacknowledged row (M9 AC11). The Home badge counts rows with `acknowledgedAt = null AND supersededAt = null` on non-deleted entities. |
| Sales scope | Sales worklists ("Champion left", "Overdue go-lives") use `CustomerRole.createdById`, which equals the entity creator for new records and the Sales user who ran "Add Customer role" for an existing partner (M11 AC3, M2 AC13). |
| History | `HistoryEvent` rows are written by services in the same transaction as the audit entries and share their `actionId`. The History tab merges `HistoryEvent` and `Note` by `createdAt` desc, 50 per page (M10 AC7). Events are never updated or deleted (M10 AC6). |
| Version | Every editable aggregate has `version Int`. Clients send it back on save; a mismatch returns 409 (3.1.3 step 5). |
| Deleted entity | `deletedAt != null` hides the entity and every child row from search, worklists, the Obligations view, group tables, counts and "To pick up" (M16 AC10). Child rows are untouched, so reactivation restores everything, including handoffs with status `SENT` (M16 AC13, resolution 39). |
| Dates | Business dates use `@db.Date` (no time). Event times use `timestamptz` in UTC, displayed in the viewer's local time with the UTC offset on the Audit tab (M16 AC2). |

#### 3.2.5 Handoff snapshot JSON

`Handoff.snapshot` is written once at send time and never updated (M3 AC10, M8 AC3, AC14). Types in `src/server/services/handoff.types.ts`:

```ts
type DateStr = string; // "2026-10-02"

export type SalesToOpsSnapshot = {
  v: 1;
  type: "SALES_TO_OPS";
  entity: {
    legalName: string; lei: string | null; leiStatus: LeiStatus | null;
    type: EntityType | null; country: string | null;
    groupName: string | null; standalone: boolean;
    bics: string[]; aliases: string[];
  };
  products: { product: Scheme; country: string; contractingEntityName: string; targetGoLive: DateStr }[];
  commercialTerms: {
    currency: Currency; pricePerVerification: string;
    volumeTiers: { fromVolume: number; toVolume: number | null; pricePerVerification: string }[];
    monthlyMinimum: string | null; paymentTermDays: number;
  };
  slas: { availabilityPct: string | null; maxResponseMs: number | null; other: string | null };
  specialTerms: string | null;
  entitiesNotInPortal: string | null;
  notesForOnboarding: string | null;
  contacts: { role: ContactRole; fullName: string; email: string; phone: string | null; jobTitle: string | null }[];
};

export type OpsToCsSnapshot = {
  v: 1;
  type: "OPS_TO_CS";
  products: { productId: string; product: Scheme; country: string; stage: Stage;
              stageEnteredAt: DateStr; billableFrom: DateStr | null }[];          // M8 AC3
  blocks: { productId: string; product: Scheme; country: string; blockedBy: BlockedBy;
            reason: string; blockedSince: DateStr; handoffNote: string }[];       // M8 AC4, note max 300
  commitments: { description: string; dueDate: DateStr | null }[];               // M8 AC5
  noOpenCommitments: boolean;
  contacts: { contactId: string; role: ContactRole; fullName: string; email: string;
              phone: string | null; lastVerifiedAt: DateStr | null;
              ownedByOps: boolean; confirmed: boolean }[];                         // M8 AC6
  noChampionWarning: boolean;                                                      // M8 AC7
  noteForCsm: string | null;                                                       // M8 AC8, max 1,000
};
```

A resend after a decline creates a new `Handoff` with `previousHandoffId` set. The form prefills `blocks[].handoffNote`, `commitments`, `noOpenCommitments` and `noteForCsm` from the declined snapshot and leaves every `confirmed` unticked (M8 AC12, resolution 35).

#### 3.2.6 Issue flow schema additions (migration `0003_issue_flow`, milestone 6A)

The issue flow adds the models and enums below to `prisma/schema.prisma` and changes existing models as listed in 3.2.6.2. Generate the migration with `prisma migrate dev --create-only --name issue_flow` and add the hand-written SQL of 3.2.6.4: the `CREATE SEQUENCE` line goes first in `migration.sql`, before the generated `CREATE TABLE "Issue"` that uses it as a default, and the rest goes at the end. Then run `prisma/grants.sql` again so `hub_app` gets its rights on the new tables (the `ON ALL TABLES` grants cover only tables that exist when they run). Prisma writes `ALTER TYPE ... ADD VALUE` for the extended enums; no statement in this migration uses the new enum values. Every field that only R2 writes exists from 6A and stays null in R1 (decision B37).

##### 3.2.6.1 New enums and models

```prisma
// ───────────── Issue flow enums (labels in 3.3.5) ─────────────

enum IssueType {
  SERVICE_UNAVAILABLE   // "Service unavailable or latency"
  PARTNER_DEGRADED      // "Partner degraded or unavailable"
  WRONG_MATCH           // "Wrong match result"
  INTEGRATION_BLOCKER   // "Integration blocker"
  BILLING               // "Billing"
  DATA_BREACH_SECURITY  // "Possible data breach or security"
  COMMERCIAL_COVERAGE   // "Commercial or coverage"
  OTHER                 // "Other"
}

enum Severity {
  SEV1
  SEV2
  SEV3
  SEV4
}

enum IssueStatus {
  NEW
  IN_PROGRESS
  WAITING_ON_CUSTOMER
  WAITING_ON_PARTNER
  RESOLVED
  CLOSED
}

enum IssueImpact {
  DOWN
  DEGRADED
  ISOLATED_CASE
  QUESTION_OR_REQUEST
}

enum IssueReporterKind {
  USER
  MONITORING // "Monitoring (automatic)", seed only (ISS-1042)
}

enum CustomerReporterKind {
  CONTACT
  SOMEONE_ELSE
  FOUND_INTERNALLY
}

enum RoutingRule {
  NAMED_PERSON               // rule 2
  ON_CALL_IN_HOURS           // rule 2, no named person
  ON_CALL_OUT_OF_HOURS       // rule 3
  QUEUED_FOR_BUSINESS_HOURS  // rule 4
  INHERITED_FROM_PARENT      // rule 7, linked issue
  COMPLIANCE_ON_CALL         // Sev-1 out of hours for an owner team without on-call: the Compliance on-call person (4.9.2)
  BACKUP_FOR_ABSENT          // R2, M18 AC12
}

enum CommunicatorRule {
  CUSTOMER_OWNER              // default (M18 AC7)
  ISSUE_OWNER_PARTNER         // partner issue (rule 7)
  ISSUE_OWNER_UNTIL_HANDOVER  // rules 3 and 3b, until Issue.handoverAt
  TAKEN_OVER                  // R2, M22 AC17
}

enum CommunicationType {
  FIRST_NOTIFICATION
  UPDATE
  FACTS_PACK_SENT         // R2
  BREACH_NOTIFICATION     // R2
  CLOSURE_CONFIRMED
  ROOT_CAUSE_REPORT_SENT  // R2
  SYSTEM                  // hand-over, communicator change, reopen, automatic close (grey, actor "Customer Hub")
}

enum CommunicationChannel {
  EMAIL
  PHONE
  VIDEO_CALL
  CHAT
}

enum IssueNoteKind {
  NOTE
  ADDED_REPORT // "Also reported by <name> (<team>)", M17 AC6
  SYSTEM       // hand-over, "Resolved with partner issue ...", communicator change
}

enum IssueLinkKind {
  CREATED  // created from the partner issue, follows the parent's owner (M23 AC7, AC17)
  ATTACHED // existing customer issue, keeps its own owner (M23 AC8)
}

enum AssessmentOutcome {
  POSSIBLE_MAJOR_INCIDENT
  POSSIBLE_DATA_BREACH
  NEITHER
}

enum RegulatoryRegime {
  EU_DORA
  UK_FCA
  UNITED_STATES
  SINGAPORE_MAS
  UAE_CBUAE
  OTHER
  NONE
}

// ───────────── Issues ─────────────

model Issue {
  id                        String               @id @default(cuid())
  number                    Int                  @unique @default(dbgenerated("nextval('issue_number_seq')")) // display "ISS-" + 4 digits
  entityId                  String
  entity                    Entity               @relation(fields: [entityId], references: [id])
  productId                 String?
  product                   ContractedProduct?   @relation(fields: [productId], references: [id])
  scheme                    Scheme?
  country                   String?              @db.Char(2)
  type                      IssueType
  impact                    IssueImpact
  possibleBreach            Boolean
  proposedSeverity          Severity // computed on the server at save (4.9.4); a severity in the request is ignored
  severity                  Severity
  severityCapLabel          String?              @db.VarChar(200) // "Sev-3 maximum before go-live: EU VoP / DE is at UAT"
  stageAtReport             Stage? // stage that decided the cap (M19 AC2, AC3)
  description               String               @db.VarChar(5000)
  awareAt               DateTime             @db.Timestamptz(3)
  reporterKind              IssueReporterKind    @default(USER)
  reporterId                String? // null only for MONITORING
  reporter                  User?                @relation("IssueReporter", fields: [reporterId], references: [id])
  reporterTeam              Team?
  customerReporterKind      CustomerReporterKind
  customerReporterContactId String?
  customerReporterContact   Contact?             @relation("IssueCustomerReporter", fields: [customerReporterContactId], references: [id])
  customerReporterName      String?              @db.VarChar(120) // contact name snapshot or the "Someone else" name
  status                    IssueStatus          @default(NEW)

  // Routing (M18). Effective communicator is computed on read (4.9.7)
  ownerTeam                 Team
  ownerId                   String? // null only while queued with no named person (rule 4)
  owner                     User?                @relation("IssueOwner", fields: [ownerId], references: [id])
  ownerSince                DateTime?            @db.Timestamptz(3)
  routingRule               RoutingRule
  routingReason             String               @db.VarChar(300) // "Why this owner" line
  communicatorRule          CommunicatorRule     @default(CUSTOMER_OWNER)
  handoverAt                DateTime?            @db.Timestamptz(3) // customer owner's business-hours start (rules 3, 3b)
  handoverWrittenAt         DateTime?            @db.Timestamptz(3) // set by the idempotent system write
  takenOverById             String? // R2
  takenOverBy               User?                @relation("IssueTakenOverBy", fields: [takenOverById], references: [id])

  // Clocks (M19): starts and due times are stored when a clock starts or is recalculated; states are computed on read
  clocksStartAt             DateTime             @db.Timestamptz(3) // save time, or the owner team's next business start (rule 4)
  ackStartAt                DateTime?            @db.Timestamptz(3) // null on CREATED linked issues
  ackDueAt                  DateTime?            @db.Timestamptz(3)
  acknowledgedAt            DateTime?            @db.Timestamptz(3)
  acknowledgedById          String?
  acknowledgedBy            User?                @relation("IssueAcknowledgedBy", fields: [acknowledgedById], references: [id])
  notifyRequired            Boolean // false at Sev-3, Sev-4 and before go-live
  notifyStartAt             DateTime?            @db.Timestamptz(3)
  notifyTargetHours         Int? // Sev-1: card value read when the clock starts
  notifyDefaultTarget       Boolean              @default(false) // "Default deadline: the contract has no notification time"
  notifyTargetBusinessMins  Int? // Sev-2: 240
  notifyDueAt               DateTime?            @db.Timestamptz(3)
  notifiedAt                DateTime?            @db.Timestamptz(3) // first FIRST_NOTIFICATION entry
  severityRaisedAfterNotice Boolean              @default(false) // M19 edge case 1

  // Compliance flag (M25)
  complianceFlaggedAt       DateTime?            @db.Timestamptz(3)
  complianceReasons         String[] // reason lines, for example "Sev-1 at a regulated customer (UK FCA)"
  complianceClockStartAt    DateTime?            @db.Timestamptz(3) // set while the flagged issue is Sev-1
  complianceAssessorId      String?
  complianceAssessor        User?                @relation("IssueComplianceAssessor", fields: [complianceAssessorId], references: [id])
  complianceVisibleFrom     DateTime?            @db.Timestamptz(3) // rule 4 for a flag below Sev-1 out of Compliance hours
  complianceClosedAt        DateTime?            @db.Timestamptz(3) // "Neither"

  // Resolution and closure
  resolvedAt                DateTime?            @db.Timestamptz(3)
  closedAt                  DateTime?            @db.Timestamptz(3)
  closedById                String?
  closedBy                  User?                @relation("IssueClosedBy", fields: [closedById], references: [id])
  closedAutomatically       Boolean              @default(false) // R2
  waitingOnCustomerSince    DateTime?            @db.Timestamptz(3) // R2 "Remind customer" count
  remindedAt                DateTime?            @db.Timestamptz(3) // R2

  groupReportId             String?
  groupReport               IssueGroupReport?    @relation(fields: [groupReportId], references: [id])
  relatedToIssueId          String? // R2, "Related to ISS-1031" (M22 AC16)
  relatedToIssue            Issue?               @relation("IssueRelatedTo", fields: [relatedToIssueId], references: [id])
  relatedFrom               Issue[]              @relation("IssueRelatedTo")

  version                   Int                  @default(0)
  createdAt                 DateTime             @default(now()) @db.Timestamptz(3)
  updatedAt                 DateTime             @updatedAt @db.Timestamptz(3)

  resolutions               IssueResolution[]
  contributors              IssueContributor[]
  notes                     IssueNote[]
  communications            IssueCommunication[]
  assessments               ComplianceAssessment[]
  childLinks                IssueLink[]          @relation("IssueLinkParent")
  parentLinks               IssueLink[]          @relation("IssueLinkChild")
  rootCauseTask             RootCauseReportTask?
  historyEvents             HistoryEvent[]

  @@index([entityId, status])
  @@index([entityId, scheme, country, status])
  @@index([ownerId, status])
  @@index([reporterId])
  @@index([complianceAssessorId])
  @@index([status, clocksStartAt])
  @@index([handoverAt])
}

model IssueResolution {
  id                  String    @id @default(cuid())
  issueId             String
  issue               Issue     @relation(fields: [issueId], references: [id])
  rootCause           String    @db.VarChar(2000)
  solution            String    @db.VarChar(2000)
  resolvedAt          DateTime  @db.Timestamptz(3)
  resolvedById        String
  resolvedBy          User      @relation("IssueResolutionBy", fields: [resolvedById], references: [id])
  cascadedFromIssueId String? // set on linked issues resolved by the partner issue (M23 AC11)
  supersededAt        DateTime? @db.Timestamptz(3) // back to In progress before close (M21 AC5)
  supersededReason    String?   @db.VarChar(500)

  @@index([issueId, resolvedAt(sort: Desc)])
}

model IssueGroupReport {
  id          String   @id @default(cuid())
  groupId     String
  group       Group    @relation(fields: [groupId], references: [id])
  createdById String
  createdBy   User     @relation("IssueGroupReportBy", fields: [createdById], references: [id])
  createdAt   DateTime @default(now()) @db.Timestamptz(3)
  issues      Issue[] // shown as "Related issues" on each Issue page (M17 AC4)
}

model IssueLink {
  id            String        @id @default(cuid())
  parentId      String // the partner issue
  parent        Issue         @relation("IssueLinkParent", fields: [parentId], references: [id])
  childId       String // the customer issue
  child         Issue         @relation("IssueLinkChild", fields: [childId], references: [id])
  kind          IssueLinkKind
  createdById   String // actor; the audit entry names the user
  createdAt     DateTime      @default(now()) @db.Timestamptz(3)
  unlinkedAt    DateTime?     @db.Timestamptz(3) // M23 AC14
  unlinkedById  String?
  unlinkReason  String?       @db.VarChar(500)

  @@index([parentId])
  @@index([childId])
}

model IssueContributor {
  id        String    @id @default(cuid())
  issueId   String
  issue     Issue     @relation(fields: [issueId], references: [id])
  userId    String
  user      User      @relation("IssueContributorUser", fields: [userId], references: [id])
  isDefault Boolean   @default(false) // added by routing rule 5
  addedAt   DateTime  @default(now()) @db.Timestamptz(3)
  removedAt DateTime? @db.Timestamptz(3) // removal keeps the row; the audit entry names the actor

  @@index([userId, removedAt])
  @@index([issueId])
}

model IssueNote {
  id         String        @id @default(cuid())
  issueId    String
  issue      Issue         @relation(fields: [issueId], references: [id])
  kind       IssueNoteKind @default(NOTE)
  body       String        @db.VarChar(5000)
  details    Json? // ADDED_REPORT: { description, awareAt, reportedBy, impact, possibleBreach, suggestsSeverity }
  authorId   String? // null for SYSTEM
  author     User?         @relation("IssueNoteAuthor", fields: [authorId], references: [id])
  authorName String        @db.VarChar(120) // "Customer Hub" for SYSTEM
  authorTeam Team?
  createdAt  DateTime      @default(now()) @db.Timestamptz(3)

  @@index([issueId, createdAt(sort: Desc)])
  @@index([authorId, kind])
}

model IssueCommunication {
  id             String                @id @default(cuid())
  issueId        String
  issue          Issue                 @relation(fields: [issueId], references: [id])
  type           CommunicationType
  occurredAt     DateTime              @db.Timestamptz(3) // the "Time" field; not in the future, not before awareAt
  channel        CommunicationChannel? // null for SYSTEM
  contactId      String?
  contact        Contact?              @relation("IssueCommunicationContact", fields: [contactId], references: [id])
  personName     String?               @db.VarChar(120) // contact name snapshot or free text
  message        String                @db.VarChar(5000)
  recordedById   String? // null for SYSTEM
  recordedBy     User?                 @relation("IssueCommunicationRecordedBy", fields: [recordedById], references: [id])
  recordedByName String                @db.VarChar(120)
  systemKey      String?               @unique @db.VarChar(120) // idempotency key of on-read system writes, e.g. "handover:<issueId>"
  createdAt      DateTime              @default(now()) @db.Timestamptz(3)

  @@index([issueId, occurredAt(sort: Desc)])
}

model ComplianceAssessment {
  id               String            @id @default(cuid())
  issueId          String
  issue            Issue             @relation(fields: [issueId], references: [id])
  outcome          AssessmentOutcome
  rationale        String            @db.VarChar(1000)
  assessedById     String
  assessedBy       User              @relation("ComplianceAssessmentBy", fields: [assessedById], references: [id])
  assessedAt       DateTime          @db.Timestamptz(3)
  // Facts for the customer's regulator (R2, M25 AC9); target read once from the card
  factsTargetHours Int?
  factsDueAt       DateTime?         @db.Timestamptz(3)
  factsStoppedAt   DateTime?         @db.Timestamptz(3)
  // Data breach notification (R2, M25 AC10)
  breachRuleLabel  String?           @db.VarChar(200)
  breachDueAt      DateTime?         @db.Timestamptz(3)
  breachStoppedAt  DateTime?         @db.Timestamptz(3)

  @@index([issueId, assessedAt(sort: Desc)])
}

model RootCauseReportTask { // R2, M27
  id              String                @id @default(cuid())
  issueId         String                @unique
  issue           Issue                 @relation(fields: [issueId], references: [id])
  createdAt       DateTime              @default(now()) @db.Timestamptz(3)
  reportDays      Int? // card value read once at creation
  dueDate         DateTime?             @db.Date
  sentAt          DateTime?             @db.Timestamptz(3)
  sentToContactId String?
  sentToContact   Contact?              @relation("RootCauseReportContact", fields: [sentToContactId], references: [id])
  sentToName      String?               @db.VarChar(120)
  channel         CommunicationChannel?
  reportUrl       String?               @db.VarChar(2048)
  summary         String?               @db.VarChar(2000)
  sentById        String?
  sentBy          User?                 @relation("RootCauseReportSentBy", fields: [sentById], references: [id])
}

model IssueTeamMember {
  id           String @id @default(cuid())
  entityId     String
  entity       Entity @relation(fields: [entityId], references: [id])
  team         Team // SALES, OPS, NETWORK, FINANCE or COMPLIANCE; the customer owner is Entity.ownerId
  userId       String
  user         User   @relation("IssueTeamMemberUser", fields: [userId], references: [id])
  backupUserId String? // R2, M18 AC12
  backupUser   User?  @relation("IssueTeamMemberBackup", fields: [backupUserId], references: [id])

  @@unique([entityId, team])
  @@index([userId])
}

model OnCallShift {
  id       String   @id @default(cuid())
  team     Team // OPS, NETWORK or COMPLIANCE
  userId   String
  user     User     @relation("OnCallShiftUser", fields: [userId], references: [id])
  startsAt DateTime @db.Timestamptz(3)
  endsAt   DateTime @db.Timestamptz(3) // exclusive

  @@index([team, startsAt, endsAt])
}

model TeamBusinessHours {
  team      Team    @id
  timeZone  String? @db.VarChar(64) // IANA; null = each user's own time zone (Sales, CS)
  startTime String  @db.Char(5) // "09:00", inclusive
  endTime   String  @db.Char(5) // "18:00", exclusive
  weekdays  Int[] // ISO weekday 1 = Monday ... 7 = Sunday; seed [1, 2, 3, 4, 5]
}
```

##### 3.2.6.2 Changes to existing models

| Model | Change | Why |
|---|---|---|
| `User` | Add `timeZone String @default("Europe/Bucharest") @db.VarChar(64)` (IANA) and `absentUntil DateTime? @db.Date` (R2). Add the back-relations: `issuesReported Issue[] @relation("IssueReporter")`, `issuesOwned Issue[] @relation("IssueOwner")`, `issuesAcknowledged Issue[] @relation("IssueAcknowledgedBy")`, `issuesClosed Issue[] @relation("IssueClosedBy")`, `issuesToAssess Issue[] @relation("IssueComplianceAssessor")`, `issuesTakenOver Issue[] @relation("IssueTakenOverBy")`, `issueResolutions IssueResolution[] @relation("IssueResolutionBy")`, `issueGroupReports IssueGroupReport[] @relation("IssueGroupReportBy")`, `issueContributions IssueContributor[] @relation("IssueContributorUser")`, `issueNotes IssueNote[] @relation("IssueNoteAuthor")`, `issueCommunications IssueCommunication[] @relation("IssueCommunicationRecordedBy")`, `complianceAssessments ComplianceAssessment[] @relation("ComplianceAssessmentBy")`, `rootCauseReportsSent RootCauseReportTask[] @relation("RootCauseReportSentBy")`, `issueTeamMemberships IssueTeamMember[] @relation("IssueTeamMemberUser")`, `issueTeamBackups IssueTeamMember[] @relation("IssueTeamMemberBackup")`, `onCallShifts OnCallShift[] @relation("OnCallShiftUser")` | B17, M18 AC12 |
| `Entity` | Add `issues Issue[]` and `issueTeam IssueTeamMember[]` | M17, M18 AC3 |
| `Group`, `ContractedProduct` | Add `issueGroupReports IssueGroupReport[]` on `Group`; `issues Issue[]` on `ContractedProduct` | M17 AC2, AC4 |
| `Contact` | Add `issuesReportedAtCustomer Issue[] @relation("IssueCustomerReporter")`, `issueCommunications IssueCommunication[] @relation("IssueCommunicationContact")`, `rootCauseReportsReceived RootCauseReportTask[] @relation("RootCauseReportContact")` | M17 AC2, M22 AC6, M27 AC5 |
| `ObligationCard` | Add `regulatoryRegime RegulatoryRegime?` (null = "Not captured"), `regimeName String? @db.VarChar(100)` (regime Other only), `regulatorDeadline String? @db.VarChar(300)` (information only), `factsNeededHours Int?` (1 to 72), `postIncidentReportDays Int?` (1 to 90, R2). Customer agreement cards only (check in 3.2.6.4) | M26 AC1, AC2 |
| `HistoryEvent` | Add `issueId String?`, `issue Issue? @relation(fields: [issueId], references: [id])` and `@@index([issueId])`: the "Incident" events link to the Issue page | M17 AC12, M10 |
| `AuditEntry` | `userTeam Team?` (was required): system writes of the issue engine have no team and render "Customer Hub (automatic)" | B36, M21 AC14 |
| `HistoryCategory` | Add `INCIDENT` (label "Incident") | M17 AC12, M10 AC8 |
| `AuditObjectType` | Add `ISSUE` (label "Issue"; `objectLabel` "Issue: ISS-1042") | M17 AC12, M19 AC20 |
| `AuditSource` | Add `SYSTEM_ISSUE` (rendered "Customer Hub (automatic)") | B36 |

##### 3.2.6.3 Modelling rules for issues

| Topic | Rule |
|---|---|
| Issue ID | `number` comes from the Postgres sequence `issue_number_seq`. Display `ISS-` + the number padded to 4 digits ("ISS-1043"). The seed inserts 1031, 1038 and 1042 explicitly and then sets the sequence so the next issue is ISS-1043 (7.1.17). Route and API paths take the display ID |
| Stored and computed | Stored: what happened and when (report fields, owner, routing rule, clock starts, due times computed when a clock starts or is recalculated, acknowledgement, notifications, assessments, resolution, closure). Computed on read from `now()` of `src/lib/dates.ts`: clock states and texts, the effective communicator, whether a queued issue is visible yet, worklist rows, steps, badge, affected customers, flags such as the US alert (4.9) |
| Customer issue and partner issue | A partner issue is an issue of type `PARTNER_DEGRADED` on an entity with an active Partner role that is not the child of an active `IssueLink`. Every other issue is a customer issue, linked customer issues included |
| Effective communicator | `CUSTOMER_OWNER`: `Entity.ownerId` at read time. `ISSUE_OWNER_PARTNER`: `Issue.ownerId`. `ISSUE_OWNER_UNTIL_HANDOVER`: `Issue.ownerId` while `now < handoverAt`, then `Entity.ownerId`. `TAKEN_OVER` (R2): `takenOverById`. No customer owner gives "No communicator: set an owner on the entity" (M18 edge case 6). One function, `effectiveCommunicator()` (4.9.7), serves the UI, the worklist and `can()` |
| Linked issues | A `CREATED` link copies the parent's `ownerId` into the child in the same transaction on create, reassignment and type change of the parent (M23 AC17). An `ATTACHED` link never changes the child's owner. `unlinkedAt` ends the link; the child keeps the owner it had at that moment (M23 AC14) |
| Contributors | Active contributors are the rows with `removedAt = null`. Removal sets `removedAt`; a later re-add creates a new row |
| Notes and the log | `IssueNote` and `IssueCommunication` rows are append-only: no update or delete route, and `hub_app` has no `UPDATE` on them (3.2.6.4). A wrong log entry is corrected by a new entry starting "Correction:" (M22 AC8) |
| Resolution | The latest `IssueResolution` with `supersededAt = null` is the "Resolution" block; superseded rows show marked "Superseded" (M21 AC5) |
| Regulatory block | Lives on the Customer agreement `ObligationCard` only. Regime None clears `factsNeededHours` and `postIncidentReportDays` on save; the audit log keeps the old values (M26 AC4) |
| Snapshots | `notifyTargetHours`, `factsTargetHours`, `reportDays` and `breachRuleLabel` are read once when their clock or task starts; a later card edit changes only clocks and tasks started after it (M19 AC5, M26 AC7) |
| Soft-deleted entity | Issues of a deleted entity leave every worklist, count and affected-customers list (M20 edge case 6, M23 edge case 6). The Issue page follows the deleted-record rule of 4.8.1: the admin reads it, other users see the deleted-record page. Nothing on the issue changes, so reactivation restores it |
| Version | `Issue.version` follows the concurrency rule of 3.1.3 step 5. A stale write returns 409 "This issue was updated by <name> at <time>. Reload to see the current state." (M21 edge case 2) |

##### 3.2.6.4 Hand-written SQL (added to `0003_issue_flow`)

```sql
-- First line of migration.sql. Issue numbers (display ISS-1043 and up); the seed calls setval after inserting the seeded issues
CREATE SEQUENCE IF NOT EXISTS issue_number_seq START 1043;

-- One active contributor row per user and issue; one active parent per linked issue
CREATE UNIQUE INDEX "IssueContributor_one_active"
  ON "IssueContributor" ("issueId", "userId") WHERE "removedAt" IS NULL;
CREATE UNIQUE INDEX "IssueLink_one_active_parent"
  ON "IssueLink" ("childId") WHERE "unlinkedAt" IS NULL;

-- Range checks that mirror the Zod rules (3.4.3)
ALTER TABLE "Issue"
  ADD CONSTRAINT "Issue_description_length" CHECK (char_length("description") BETWEEN 20 AND 5000),
  ADD CONSTRAINT "Issue_reporter_kind" CHECK (("reporterKind" = 'USER') = ("reporterId" IS NOT NULL)),
  ADD CONSTRAINT "Issue_scheme_country_pair" CHECK (("scheme" IS NULL) = ("country" IS NULL));
ALTER TABLE "ObligationCard"
  ADD CONSTRAINT "ObligationCard_facts_range" CHECK ("factsNeededHours" IS NULL OR "factsNeededHours" BETWEEN 1 AND 72),
  ADD CONSTRAINT "ObligationCard_report_days_range" CHECK ("postIncidentReportDays" IS NULL OR "postIncidentReportDays" BETWEEN 1 AND 90),
  ADD CONSTRAINT "ObligationCard_regulatory_customer_only" CHECK (
    "kind" = 'CUSTOMER_AGREEMENT'
    OR ("regulatoryRegime" IS NULL AND "regimeName" IS NULL AND "regulatorDeadline" IS NULL
        AND "factsNeededHours" IS NULL AND "postIncidentReportDays" IS NULL));
```

`prisma/grants.sql` gains, after its existing lines:

```sql
REVOKE UPDATE ON "IssueNote", "IssueCommunication" FROM hub_app;   -- append-only (M21 AC7, M22 AC8)
```

No issue table needs `DELETE` for `hub_app`: contributor removal and unlinking set a timestamp.

### 3.3 Enums and reference lists

All labels live in `src/lib/labels.ts`. The UI, the audit values and the History sentences use these labels and never the raw enum value.

#### 3.3.1 Onboarding stages (fixed order, M6 AC1)

| # | Enum | Label | Short label at 1024px |
|---|---|---|---|
| 1 | `CONTRACT_SIGNED` | Contract signed | Contract |
| 2 | `KICKOFF` | Kickoff | Kickoff |
| 3 | `SANDBOX_TECHNICAL_INTEGRATION` | Sandbox & technical integration | Sandbox |
| 4 | `TESTING_CERTIFICATION` | Testing & certification | Testing |
| 5 | `UAT` | UAT | UAT |
| 6 | `GO_LIVE_APPROVAL` | Go-live approval | Approval |
| 7 | `LIVE_HYPERCARE` | Live & hypercare | Hypercare |
| 8 | `RAMP_UP` | Ramp-up | Ramp-up |
| 9 | `BAU` | BAU | BAU |

`STAGE_ORDER` is the array above; comparisons use its index. "Before Live & hypercare" means index < 7.

#### 3.3.2 Value labels

| Enum | Values → labels |
|---|---|
| `Team` | SALES "Sales", OPS "Ops", CS "Customer Success", NETWORK "Network", COMPLIANCE "Compliance", FINANCE "Finance". Owner labels: "Owned by <label>", plus "Owned by Sales and Customer Success" and "Owned by Sales and Finance" |
| `EntityType` | BANK "Bank", FINTECH "Fintech", PSP "PSP" |
| `Scheme` (product or scheme) | EU_VOP "EU VoP", UK_COP "UK CoP", GLOBAL_VALIDATION "Global validation" |
| `LeiStatus` | ISSUED "Issued", LAPSED "LEI lapsed", RETIRED "Retired", MERGED "Merged", ANNULLED "Annulled", DUPLICATE "Duplicate", PENDING_TRANSFER "Pending transfer", PENDING_ARCHIVAL "Pending archival", NOT_VERIFIED "Not verified with GLEIF" |
| `LifecycleState` | ONBOARDING "Onboarding", LIVE "Live", BAU "BAU", INACTIVE "Inactive" (sort order as listed) |
| Role (derived) | "Customer", "Network partner"; search filter values "Customer", "Network partner", "Both" |
| `BlockedBy` | CUSTOMER "Customer", Corvane "Corvane", PARTNER "Partner" |
| `ConnectionMethod` | DIRECT "Direct", VIA_SCHEME "Via scheme", VIA_ROUTING_PROVIDER "Via routing provider" |
| `CoverageStatus` | ONBOARDING "Onboarding" (neutral), ACTIVE "Active" (positive), DEGRADED "Degraded" (warning), SUSPENDED "Suspended" (critical), RETIRED "Retired" (muted) |
| `ContractScope` | ENTITY_CONTRACT "Entity contract", GROUP_MASTER_AGREEMENT "Group master agreement" |
| `Currency` | EUR, GBP, USD |
| `ContactContext` | CUSTOMER "Customer", PARTNER "Partner" |
| `ContactRole` | CHAMPION "Champion", DECISION_MAKER "Decision maker", TECHNICAL "Technical", INCIDENT "Incident", ESCALATION "Escalation", BILLING "Billing". Contacts tab order: Incident, Escalation, Technical, Champion, Decision maker, Billing (M7 AC11) |
| `ContactStatus` | ACTIVE "Active", LEFT "Left" |
| `KybCheckType` | LICENCE "Licence", LEI "LEI", OWNERSHIP_STRUCTURE "Ownership structure", SANCTIONS_SCREENING "Sanctions screening". Computed status: "Not started", "Verified", "Expiring", "Expired" |
| `SanctionsResult` | NO_MATCH "No match", POTENTIAL_MATCH_UNDER_REVIEW "Potential match under review", CONFIRMED_MATCH "Confirmed match" |
| `ReviewStatus` | PLANNED "Planned", IN_PROGRESS "In progress", COMPLETED "Completed", OVERDUE "Overdue"; marker "Past due" |
| `ObligationCardKind` | CUSTOMER_AGREEMENT "Customer agreement", PARTNER_AGREEMENT "Partner agreement"; Obligations view role column "Customer" / "Partner" |
| `SchemeAdherence` | NOT_APPLICABLE "Not applicable", NOT_STARTED "Not started", IN_PROGRESS "In progress", ADHERED "Adhered", SUSPENDED "Suspended", WITHDRAWN "Withdrawn" |
| `HandoffType` | SALES_TO_OPS "Sales → Ops", OPS_TO_CS "Ops → CS" |
| `HandoffStatus` | SENT "Sent", CONFIRMED "Confirmed", ACCEPTED "Accepted", DECLINED "Declined", CANCELLED "Cancelled" |
| `NoteType` | CALL "Call", QBR "QBR", NEGOTIATION "Negotiation", INCIDENT "Incident", PAYMENT "Payment", OTHER "Other" |
| `ActionItemStatus` | OPEN "Open", DONE "Done" |
| `HistoryCategory` (History event-type filter, M10 AC8) | STAGE_CHANGE "Stage change", CONTACT_CHANGE "Contact change", HANDOFF "Handoff", OWNER_REASSIGNED "Owner reassigned", NETWORK_AND_STRUCTURE "Network and structure", OTHER_FIELD_CHANGES "Other field changes" (off by default) |
| `AuditObjectType` | Object labels: "Legal entity", "Group", "Customer role", "Partner role", "Coverage row", "Contract", "Contracted product", "Contact", "KYB", "Periodic review", "Obligations", "Billing profile", "Handoff", "Note", "Action item", "Owner", "User". `objectLabel` examples: "Contact: Priya Nair (Incident)", "KYB: Licence", "Coverage row: GB / UK CoP", "Contracted product: EU VoP / DE" |

#### 3.3.3 HistoryEvent category per event

| Category | Events |
|---|---|
| STAGE_CHANGE | Stage forward, skip, "Stage moved back", block set, edited, resolved (with days), target go-live changed, "Product line added: <product>, <country>, target go-live <date>", product line edited, product line cancelled, "Billable from date removed" |
| CONTACT_CHANGE | Contact added, role, email, phone or availability changed, marked as left, set back to Active, primary incident contact changed. "Mark as verified" writes audit only (M7 AC15) |
| HANDOFF | Sales → Ops sent, recipient changed, confirmed, and "Owner changed from <Sales user> to <Onboarding Manager>"; Ops → CS sent, accepted (with owner change), declined, cancelled (M9 AC12) |
| OWNER_REASSIGNED | M9 reassignment and "Set owner" |
| NETWORK_AND_STRUCTURE | "Record created by <name> (Sales)", "Duplicate warning acknowledged: <reason>", "LEI status override: <reason>", coverage status and connection method changes, roles added or removed, group link, move, unlink, contract or partner agreement attached, edited or removed, invoiced entity changed, lifecycle state set to Inactive or back, reactivation with LEI conflict reason |
| OTHER_FIELD_CHANGES | Entity core field edits, commercial terms, handoff summary, renewal date, KYB, periodic review, obligations, billing profile, GLEIF refresh results |
| INCIDENT (issue flow, 3.3.5) | Every issue write of 4.9.11: reported, added report, routed, acknowledged, status change, resolved, closed, severity or type change, clock outcome, contributor change, reassignment, note added, communication recorded, communicator change and hand-over, Compliance flag and assessment, linked issue created, attached or unlinked, coverage proposal accepted, root cause report task (R2). Each event carries `issueId` and links to the Issue page |

#### 3.3.4 Reference lists and constants (`src/server/config.ts`)

| Constant | Value | AC |
|---|---|---|
| `COUNTRIES` | All ISO 3166-1 alpha-2 codes with English names from the npm package `i18n-iso-countries` (locale `en`), shown as "AT Austria" | M1 AC5, M2 AC2 |
| `SEPA_COUNTRIES` | AT, BE, BG, CY, CZ, DE, DK, EE, ES, FI, FR, GR, HR, HU, IE, IT, LT, LU, LV, MT, NL, PL, PT, RO, SE, SI, SK, IS, LI, NO, CH, GB, MC, SM, AD, VA, AL, ME, MD, MK, GI, GG, JE, IM, AX, GF, GP, MQ, RE, YT, PM, BL, MF. Static; check against the EPC list of SEPA countries before the demo | M3 AC2, M5 AC4 |
| `EU_VAT_PREFIX` | The 27 EU member states, prefix = ISO code except Greece `GR → EL` | M14 AC2 |
| `CORVANE_CONTRACTING_ENTITIES` | "Corvane Singapore Pte. Ltd.", "Corvane Europe B.V." | M14 AC1 |
| `APPROVED_DOC_HOSTS` | From env, default `docs.corvane-internal.example` | Shared conventions, M12 AC7, M13 AC2 |
| `TIME_ZONES` | `Intl.supportedValuesOf("timeZone")` plus `UTC` | M7 AC4 |
| `STAGE_THRESHOLD_DAYS` | Contract signed to Go-live approval: 21. Live & hypercare: 56. Ramp-up and BAU: excluded | M11 AC6 |
| `GO_LIVE_WINDOW_DAYS` | 14 (inclusive) | M11 AC8 |
| `RENEWAL_WINDOW_DAYS` | 120; chips Overdue, ≤30 days, 31-60 days, 61-90 days, 91-120 days | M11 AC11, resolution 11 |
| `COMPLIANCE_WINDOW_DAYS` | 90; chips Overdue, ≤30 days, 31-60 days, 61-90 days | M11 AC13 |
| `KYB_EXPIRING_DAYS` | 90 | M12 AC8 |
| `OBLIGATION_EXPIRY_BADGE_DAYS` | 90 | M13 AC7 |
| `NETWORK_STALE_CONTACT_DAYS` | 90 (stale from 91 days) | M11 AC14, edge 3 |
| `FINANCE_STALE_CONTACT_MONTHS` | 6 calendar months | M11 AC15 |
| `HANDOFF_HIGHLIGHT_BUSINESS_DAYS` | 2 (Monday to Friday, no holidays) | M3 AC18, M11 AC5, AC10, AC24 |
| `RENEWAL_ALERT_DAYS` | 30 (Overview alert) | M1 AC14 |
| `NOTE_EDIT_WINDOW_HOURS` | 24 | M10 AC11 |
| `COVERAGE_MAX_FUTURE_DAYS` | 30 | M5 AC17 |
| `SEARCH_PAGE_SIZE` | 25 | M1 AC19 |
| `TIMELINE_PAGE_SIZE`, `AUDIT_PAGE_SIZE` | 50 | M10 AC7, M16 AC5 |
| `DUPLICATE_MAX_MATCHES` | 5 | M2 AC11 |
| `DUPLICATE_NAME_THRESHOLD` | From env, default 0.85 | M2 AC10 |
| `LEGAL_FORMS` | plc, SA, S.A., S.p.A., AG, Ltd, DAC, B.V., N.V., GmbH | Resolution 7 |
| `GLEIF_TIMEOUT_MS` | From env, default 5000 | M2 error state |

#### 3.3.5 Issue flow labels (`src/lib/labels.ts`)

| Enum | Values → labels |
|---|---|
| `IssueType` | SERVICE_UNAVAILABLE "Service unavailable or latency", PARTNER_DEGRADED "Partner degraded or unavailable", WRONG_MATCH "Wrong match result", INTEGRATION_BLOCKER "Integration blocker", BILLING "Billing", DATA_BREACH_SECURITY "Possible data breach or security", COMMERCIAL_COVERAGE "Commercial or coverage", OTHER "Other" (form order as listed) |
| `Severity` | SEV1 "Sev-1" (chip `danger`, red), SEV2 "Sev-2" (chip `due`, orange), SEV3 "Sev-3", SEV4 "Sev-4" (chips `neutral`, grey) |
| `IssueStatus` | NEW "New" (chip `due-outline`), IN_PROGRESS "In progress" (`neutral-outline`), WAITING_ON_CUSTOMER "Waiting on customer" and WAITING_ON_PARTNER "Waiting on partner" (`neutral`), RESOLVED "Resolved" (`success`), CLOSED "Closed" (`muted`) |
| Business-hours chip (People panel) | "In hours" (`success`), "Out of hours" (`due-outline`), against the person's own business hours (4.9.3) |
| `IssueImpact` | DOWN "Down", DEGRADED "Degraded", ISOLATED_CASE "Isolated case", QUESTION_OR_REQUEST "Question or request" |
| `IssueReporterKind` | USER (the user's name and team), MONITORING "Monitoring (automatic)" |
| `CustomerReporterKind` | CONTACT (contact name, "Former contact" label once Left), SOMEONE_ELSE (the typed name), FOUND_INTERNALLY "Found by Corvane" |
| `RoutingRule` (audit value and "Why this owner") | NAMED_PERSON "<Entity>'s named <Team> person, inside <Team> business hours"; ON_CALL_IN_HOURS "No named <Team> person on this entity: routed to on-call"; ON_CALL_OUT_OF_HOURS "Outside <Team> business hours: routed to the <Team> on-call person"; QUEUED_FOR_BUSINESS_HOURS "<Entity>'s named <Team> person, queued until the start of <Team> business hours"; INHERITED_FROM_PARENT "inherited from partner issue <ID>"; COMPLIANCE_ON_CALL "Outside <Team> business hours, <Team> has no on-call: routed to the Compliance on-call person"; BACKUP_FOR_ABSENT (R2) "<Name> is absent until <date>: routed to <backup>" |
| `CommunicatorRule` (audit value) | CUSTOMER_OWNER "Customer owner"; ISSUE_OWNER_PARTNER "Issue owner (partner issue)"; ISSUE_OWNER_UNTIL_HANDOVER "Issue owner communicates until the customer owner's hours"; TAKEN_OVER (R2) "Taken over" |
| `CommunicationType` | FIRST_NOTIFICATION "First notification", UPDATE "Update", FACTS_PACK_SENT "Facts pack sent" (label "Facts pack"), BREACH_NOTIFICATION "Breach notification" (label "Breach"), CLOSURE_CONFIRMED "Closure confirmed", ROOT_CAUSE_REPORT_SENT "Root cause report sent", SYSTEM (grey, actor "Customer Hub") |
| `CommunicationChannel` | EMAIL "Email", PHONE "Phone", VIDEO_CALL "Video call", CHAT "Chat" |
| `AssessmentOutcome` | POSSIBLE_MAJOR_INCIDENT "Possible major incident", POSSIBLE_DATA_BREACH "Possible data breach", NEITHER "Neither" |
| `RegulatoryRegime` | EU_DORA "EU DORA", UK_FCA "UK FCA", UNITED_STATES "United States", SINGAPORE_MAS "Singapore MAS", UAE_CBUAE "UAE CBUAE", OTHER "Other" (displayed "Other: <regime name>"), NONE "None: not a regulated customer"; null "Not captured" |
| `HistoryCategory` | adds INCIDENT "Incident". The History "Event type" filter value "Incident" matches the note type Incident and the INCIDENT event category together, and stays in the default set (M10 AC8) |
| `AuditObjectType` | adds ISSUE "Issue"; `objectLabel` "Issue: ISS-1042". Regulatory fields use the existing "Obligations" object |
| `AuditSource` | adds SYSTEM_ISSUE, rendered as user "Customer Hub (automatic)" with team "(system)" |

Issue ID display: `ISS-` followed by the number padded to 4 digits. Issue age (similar issues block, M17 AC5): calendar days from `createdAt` to today in the viewer's time zone: "today", "1 day", "<n> days".

#### 3.3.6 Issue flow constants (`src/server/config.ts`)

| Constant | Value | AC |
|---|---|---|
| `ISSUE_TYPE_ROUTING` | SERVICE_UNAVAILABLE → owner OPS, contributor none; PARTNER_DEGRADED → NETWORK, contributor OPS; WRONG_MATCH → OPS, NETWORK; INTEGRATION_BLOCKER → OPS, none; BILLING → FINANCE, SALES; DATA_BREACH_SECURITY → COMPLIANCE, OPS; COMMERCIAL_COVERAGE → SALES, NETWORK; OTHER → OPS, none | M18 AC2, AC8 |
| `SEVERITY_FROM_IMPACT` | DOWN → SEV1, DEGRADED → SEV2, ISOLATED_CASE → SEV3, QUESTION_OR_REQUEST → SEV4; possible breach → SEV1 | M17 AC7, M19 AC1 |
| `TYPE_SEVERITY_CAP` | BILLING and COMMERCIAL_COVERAGE: SEV2 (lifted by a possible breach) | M17 AC9, B26 |
| `PRE_GO_LIVE_CAP` | SEV3 when the deciding stage is before `LIVE_HYPERCARE` (`STAGE_ORDER` index < 7); lifted by a possible breach | M17 AC8, M19 AC2, B27 |
| `ACK_TARGET` | SEV1 15 elapsed minutes; SEV2 60 elapsed minutes; SEV3 540 business minutes of the owner (1 business day); SEV4 1,620 business minutes (3 business days) | M19 AC4 |
| `NOTIFY_TARGET` | SEV1 card "Incident notification time" in elapsed hours, default 2 hours with `notifyDefaultTarget`; SEV2 240 business minutes of the communicator; SEV3, SEV4 none | M19 AC5, B30 |
| `UPDATE_INTERVAL_MINUTES` (R2) | SEV1 120, SEV2 480. The template's "Next update by" uses the same values in R1 | M22 AC3, AC14 |
| `COMPLIANCE_ASSESS_MINUTES` | 60 on Sev-1; no countdown below Sev-1 | M25 AC5 |
| `BREACH_TARGET_HOURS` (R2) | 24 | M25 AC10 |
| `BREACH_RULE_BY_CORVANE_ENTITY` (R2) | "Corvane Europe B.V." → "GDPR: notify the customer without undue delay. Internal target 24 hours."; "Corvane Singapore Pte. Ltd." → "PDPA: notify the customer without undue delay. Internal target 24 hours."; missing → "Rule not set: contracting Corvane entity missing on the billing profile. Internal target 24 hours." | M25 AC10 |
| `US_INTERRUPTION_ALERT_HOURS` | 4 | Appendix B conventions |
| `BUSINESS_DAY_MINUTES` | 540 (09:00 to 18:00) | B30 |
| `REMIND_CUSTOMER_BUSINESS_DAYS`, `AUTO_CLOSE_BUSINESS_DAYS`, `REOPEN_WINDOW_BUSINESS_DAYS` (R2) | 5, 5, 10 | M21 AC13, AC14, M22 AC15, AC20 |
| `TEAM_TIME_ZONES` | OPS "Asia/Kuala_Lumpur"; NETWORK, COMPLIANCE, FINANCE "Asia/Singapore"; SALES, CS null (user's own). Mirrors the seeded `TeamBusinessHours` rows; the rows are the runtime source | B17 |
| `TZ_ABBREVIATIONS` | Europe/Amsterdam, Europe/Rome, Europe/Berlin, Europe/Paris, Europe/Madrid, Europe/Brussels, Europe/Vienna, Europe/Prague → CET / CEST; Europe/London → GMT / BST; Asia/Kuala_Lumpur → MYT; Asia/Singapore → SGT; America/New_York → EST / EDT. Standard or summer form by the zone's UTC offset at that instant. Any other zone shows its offset, "UTC+03:00" | B32, M19 AC12 |
| `ON_CALL_TEAMS` | OPS, NETWORK, COMPLIANCE | B19 |
| `SALES_DIRECTOR_EMAIL` | `tom.hadley@corvane.example` (Sales person fallback) | B18 |
| `ISSUE_TEAM_DEFAULTS` | OPS `adrian.koh@corvane.example`, NETWORK `lukas.brenner@corvane.example`, COMPLIANCE `mei.chen@corvane.example`, FINANCE `rachel.wong@corvane.example`; SALES = the creating Sales user | B18 |
| `GMAIL_COMPOSE_URL` | `https://mail.google.com/mail/?view=cm&fs=1` | M22 AC5 |
| `ISSUES_REFRESH_SECONDS` | 60 (Home Issues section and clock texts) | M19 AC12, M20 AC10 |
| `ISSUE_REASON_LENGTH` | 10 to 500 (severity, type, back to work, reassign, reopen, take over); unlink 5 to 500 | M19 AC13, M21 AC5, AC8, M23 AC14 |

### 3.4 Validation rules

One Zod schema per action lives in `src/lib/validation` and is used by both the client form (inline errors as the user types or on blur) and the service (authoritative check, 400 on failure). Text inputs are trimmed before every check. "(proposal)" marks copy the ACs leave open; use it as written.

#### 3.4.1 Format validators

```ts
// lib/validation/lei.ts: ISO 17442, check digits ISO 7064 MOD 97-10
export function normaliseLei(v: string) { return v.trim().toUpperCase(); }
export function isValidLei(v: string): boolean {
  if (!/^[A-Z0-9]{18}[0-9]{2}$/.test(v)) return false;
  let rem = 0;
  for (const ch of v) {
    const n = ch >= "A" ? ch.charCodeAt(0) - 55 : ch.charCodeAt(0) - 48; // A=10 ... Z=35
    for (const d of String(n)) rem = (rem * 10 + Number(d)) % 97;
  }
  return rem === 1;
}

// lib/validation/bic.ts: ISO 9362
const BIC_RE = /^[A-Z]{4}([A-Z]{2})[A-Z0-9]{2}([A-Z0-9]{3})?$/;
export function parseBic(v: string) {
  const bic = v.replace(/\s/g, "").toUpperCase();
  const m = BIC_RE.exec(bic);
  if (!m || !COUNTRY_CODES.has(m[1])) return null;
  return { bic, bic8: bic.slice(0, 8), country: m[1] };
}

// lib/validation/phone.ts: E.164
export function normalisePhone(v: string) { return v.replace(/[\s\-.()]/g, ""); }
export const E164_RE = /^\+[1-9][0-9]{7,14}$/;          // "+" then 8 to 15 digits, first digit 1-9
export function suggestPhone(v: string) {               // "0044 7700 900123" → "+447700900123"
  const n = normalisePhone(v);
  return n.startsWith("00") ? "+" + n.slice(2) : null;
}

// lib/validation/email.ts
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;   // one "@", a dot in the domain, no spaces; max 254; stored lowercase

// lib/validation/url.ts: evidence, contract and agreement links
export function checkDocLink(v: string, approved: string[]):
  "ok" | "not_https" | "host_not_approved" | "too_long" | "invalid" {
  if (v.length > 2048) return "too_long";
  let u: URL; try { u = new URL(v); } catch { return "invalid"; }
  if (u.protocol !== "https:") return "not_https";
  return approved.includes(u.hostname.toLowerCase()) ? "ok" : "host_not_approved";
}

// lib/validation/vat.ts: M14 AC2, no VIES call
export function normaliseVat(v: string) { return v.replace(/[\s.\-]/g, "").toUpperCase(); }
export function checkVat(vat: string, country: string | null): string | null {
  const prefix = EU_VAT_PREFIX[country ?? ""];            // e.g. DE → "DE", GR → "EL"
  if (prefix) {
    return new RegExp(`^${prefix}[A-Z0-9]{2,12}$`).test(vat)
      ? null : `VAT ID must start with ${prefix} for ${countryName(country!)}`;
  }
  return /^[A-Z0-9]{4,20}$/.test(vat) ? null : "VAT / tax ID must be 4 to 20 letters or digits"; // (proposal)
}

// lib/validation/timezone.ts
export const isValidTimeZone = (tz: string) => TIME_ZONES.includes(tz);
```

#### 3.4.2 Field rules

| Object | Field | Rule | Error copy | AC |
|---|---|---|---|---|
| Entity | LEI | Required in the wizard. Trim, uppercase, `isValidLei`. Invalid blocks the GLEIF lookup | "LEI must be 20 letters or digits and pass the ISO 17442 check" | M2 AC2, AC3 |
| Entity | Legal name | Required, 2 to 200 | "Enter the legal name" (proposal) | M2 AC2, S4.9 |
| Entity | Type | Required: Bank, Fintech, PSP | "Select the entity type" (proposal) | M2 AC2 |
| Entity | Country | Required, in `COUNTRIES`. Differs from GLEIF: set to the GLEIF value with the note; the user may switch back, which is audited | "Select the country" (proposal); note "GLEIF records <XX> for this LEI" | M2 AC2, AC6 |
| Entity | BICs | Optional, each `parseBic` not null, no repeat on the same entity. Country part differs from entity country: non-blocking warning | "BIC must be 8 or 11 characters (e.g. ABBYGB2L or ABBYGB2LXXX)"; warning "BIC country code GB differs from the entity country AT" (proposal) | M2 AC4 |
| Entity | Aliases | Optional, each 1 to 100, unique per entity after `normaliseSearch` | "Alias must be 100 characters or fewer" (proposal) | M2 AC2 |
| Entity | Duplicate acknowledgement | When any match is shown: checkbox ticked and reason 10 to 500. Skipped in "Add Customer role" mode | "Reason must be at least 10 characters" (proposal) | M2 AC12, AC13 |
| Entity | LEI status override | GLEIF status RETIRED, MERGED, ANNULLED or DUPLICATE and successor not used: reason 10 to 500 | "Reason must be at least 10 characters" (proposal) | M2 AC7 |
| Entity | Manual entry after "LEI not found" | Legal name, country and reason 10 to 500 | as above | M2 error state |
| Entity | Inactive reason | 10 to 500 | "Reason must be 10 to 500 characters" (proposal) | S4.9 |
| Entity | Delete reason | 10 to 500; "Delete" disabled until valid | "Reason must be 10 to 500 characters" (proposal) | M16 AC9 |
| Entity | Reactivation reason | Required 10 to 500 only when another active entity holds the same LEI | as above | M16 AC15, resolution 57 |
| Group | Name | Required, max 200, unique after `normaliseSearch` | "A group with this name already exists" (proposal) | M4 AC6 |
| Group | Parent LEI | Optional, `isValidLei`, GLEIF lookup; unreachable saves as `NOT_VERIFIED` | LEI copy above | M4 AC6 |
| Group | Headquarters country | Required, ISO | "Select the country" (proposal) | M4 AC6 |
| Contract | Contract ID | Required, `^[A-Za-z0-9\-/_]{3,50}$`, unique case-insensitive | "Contract ID must be 3 to 50 letters, digits, -, / or _" (proposal); "A contract with this ID already exists" (proposal) | M4 AC9 |
| Contract | Title | Required, 1 to 200 | "Enter the contract title" (proposal) | M4 AC9 |
| Contract | Signing date | Required, not after today | "Signing date cannot be in the future" (proposal) | M4 AC9 |
| Contract | Scope | Required (customer); partner agreements are always Entity contract | | M4 AC9, AC11 |
| Contract | Invoiced entity | Required for customer contracts: the entity or another non-deleted entity of its group; default the entity | | M4 AC9 |
| Contract | Document link | Required, `checkDocLink` = ok | "Enter a link that starts with https://" (proposal); "Use a link to approved document storage" | M4 AC9, Shared conventions |
| Product line | Product or scheme | Required | | M3 AC1 |
| Product line | Country | Required, ISO. UK CoP: GB only. EU VoP: `SEPA_COUNTRIES` only. Global validation: any | "UK CoP is available only in GB"; "EU VoP is available only in SEPA countries" (proposal) | M3 AC2 |
| Product line | Contracting entity | Required: the customer entity or any non-deleted entity of its group (wizard: the group chosen in step 1) | | M3 AC1, resolution 31 |
| Product line | Uniqueness | (customer entity, product, country, contracting entity) unique, cancelled lines included | "This product line already exists" (proposal) | M3 AC2, edge 1 |
| Product line | Target go-live | Required, valid date, not before today; not before the applicable contract's signing date when one exists | "Target go-live is in the past"; "Target go-live cannot be earlier than the contract signing date" | M3 AC3, M6 AC10, edge 6 |
| Product line | Reason on edit or target change | 5 to 500 (proposal length) | "Reason is required (5 to 500 characters)" (proposal) | M3 AC14, M6 AC10 |
| Product line | Wizard count | At least 1 line | "Add at least one product line" (proposal) | M3 AC1 |
| Product line | Cancel reason | 5 to 500 | as above | M6 AC19 |
| Stage change | Entry date | Required, not after today, not before the current `stageEnteredAt` | "Entry date cannot be in the future"; "Entry date cannot be earlier than <date> (current stage date)" (proposal) | M6 AC4, edge 3 |
| Stage change | Note | Optional, max 500 | | M6 AC4 |
| Stage change | Reason | Required 5 to 500 for a skip (target > N+1) or a backward move | "Reason is required (5 to 500 characters)" (proposal) | M6 AC5, AC6 |
| Block | Blocked by, reason | Required; reason 5 to 500; resolution note optional, max 500 | | M6 AC7, AC8 |
| Customer role | Wizard: entities not yet in the portal | Max 1,000 | | M3 AC4 |
| Customer role | Currency | Required: EUR, GBP, USD | | M3 AC5 |
| Customer role | Price per verification | Required, decimal > 0, max 4 decimals | "Enter a price greater than 0 with up to 4 decimals" (proposal) | M3 AC5 |
| Customer role | Volume tiers | Optional rows. Whole numbers; tier 1 `fromVolume >= 0`; each `toVolume > fromVolume`; each next `fromVolume = previous toVolume + 1`; only the last row may leave `toVolume` empty; price rule as above | "Tiers must be continuous" (gap); "Tiers must not overlap" (proposal) | M3 AC5, edge 5 |
| Customer role | Monthly minimum | Optional, decimal >= 0, max 2 decimals | "Enter an amount of 0 or more" (proposal) | M3 AC5 |
| Customer role | Payment term | Required, whole number 1 to 180 | "Enter a whole number of days from 1 to 180" (proposal) | M3 AC5 |
| Customer role | SLA availability % | Optional, 90.00 to 100.00, max 2 decimals | "Enter a percentage between 90.00 and 100.00" (proposal) | M3 AC6 |
| Customer role | SLA max response time | Optional, whole number > 0 (ms) | "Enter a whole number of milliseconds" (proposal) | M3 AC6 |
| Customer role | Other SLA commitments | Optional, max 1,000 | | M3 AC6 |
| Customer role | Special terms | Optional, max 2,000 | | M3 AC7 |
| Customer role | Notes for Onboarding | Optional, max 2,000 | | M3 AC9 |
| Customer role | Onboarding Manager | Required, active Ops user | "No active Onboarding Manager found. Contact the portal admin." when none exist | M3 AC9 |
| Customer role | Renewal date | Valid date, not in the past (proposal) | "Renewal date cannot be in the past" (proposal) | S4.9 |
| Partner role | Provider name | Required 2 to 120 when method = Via routing provider; cleared otherwise | "Enter the provider name (2 to 120 characters)" (proposal) | M5 AC2 |
| Coverage | Country, scheme, status, effective date, reason | All required. UK CoP: GB only. EU VoP: SEPA only | "UK CoP coverage must use country GB"; "EU VoP coverage must use a SEPA country" (proposal) | M5 AC3, AC4 |
| Coverage | Uniqueness | One row per (partner, country, scheme) | "Coverage for RO / Global validation already exists" + link "Go to existing row" | M5 AC5 |
| Coverage | Effective date | Not after today + 30; on a status change not before the current status date | "Effective date can be at most 30 days ahead"; "Effective date cannot be earlier than 12 Sep 2026 (current status date)" | M5 AC7, AC17, edge 2 |
| Coverage | Reason | New row: required, default "Initial coverage". Status change: 5 to 500 | "Reason is required (5 to 500 characters)" (proposal) | M5 AC6, AC7 |
| Coverage | Transition | Any status to any other; from Retired only to Onboarding | Hint "Re-onboarding a retired coverage" | M5 AC8 |
| Contact | Full name | Required, 2 to 120 | "Enter the full name" (proposal) | M7 AC4 |
| Contact | Email | Required, `EMAIL_RE`, max 254, stored lowercase | "Enter a valid email address" | M7 AC4 |
| Contact | Phone | `normalisePhone` then `E164_RE`; required for Incident and Escalation | "Use international format, for example +447700900123"; with `suggestPhone`: "Use international format, for example +447700900123. Did you mean +447700900123?" (proposal suffix) | M7 AC4, edge 3 |
| Contact | Time zone | IANA from `TIME_ZONES`; required for Incident, Escalation, Technical | "Select a time zone" (proposal) | M7 AC4 |
| Contact | Availability | `24/7`, or at least 1 weekday with start and end `^([01]\d|2[0-3]):[0-5]\d$`, start ≠ end; end earlier than start crosses midnight; required for Incident and Escalation | "Set the availability window" (proposal) | M7 AC4, edge 2 |
| Contact | Job title | Optional, max 120 | | M7 AC4 |
| Contact | Role offered | Only roles whose owner teams include the user's team in the chosen context | "Billing contacts are owned by Finance" | M7 AC3, edge 5 |
| Contact | Duplicate | Active contact with same email, role and context on the entity: save returns 409 `needsConfirmation`; resubmit with `confirmDuplicate: true` | "Marta Kovacs is already an active Incident contact" | M7 AC12 |
| Contact | Left date | Required, not after today; note optional max 500 (proposal) | "Leave date cannot be in the future" (proposal) | M7 AC6 |
| Contact | Wizard step 3 | At least 1 Champion or Decision maker; Sales adds only those roles | "Add at least one Champion or Decision maker" (proposal) | M3 AC8 |
| Owner | New owner | Active user in CS, Ops or Sales; different from current | "Select a different owner" | M9 AC5, AC6 |
| Owner | Reason | Required, 10 to 500 | "Reason is required (minimum 10 characters)" | M9 AC6 |
| Handoff Ops → CS | Block note | Required per open block, max 300 | "Add a handoff note for this block" (proposal) | M8 AC4 |
| Handoff Ops → CS | Commitments | At least 1 (description 5 to 300, due date optional) or "No open commitments" ticked | "Add a commitment or tick No open commitments" (proposal) | M8 AC5 |
| Handoff Ops → CS | Contacts | Every active Ops-owned customer contact ticked "Confirmed"; at least 1 active Customer-context Incident contact | "Add an active incident contact before handing over" | M8 AC6, AC7 |
| Handoff Ops → CS | Receiving CSM, note | CSM required, active CS user; note max 1,000 | | M8 AC8 |
| Handoff | Decline or cancel reason | 10 to 500 | "Reason must be 10 to 500 characters" (proposal) | M8 AC12, AC13, resolution 33 |
| Note | Type, interaction date | Required; date not after today | "Interaction date cannot be in the future" (proposal) | M10 AC2 |
| Note | Participants | Active users, active contacts of this entity, up to 10 free-text names (1 to 120 each) | | M10 AC2 |
| Note | Summary | Required, 20 to 5,000 | "Summary must be 20 to 5,000 characters" (proposal) | M10 AC2 |
| Note | Action items | 0 to 20 rows; each: description 1 to 300, owner active user, due date today or later at creation, all three required on a started row | "Complete or remove this action item" (proposal) | M10 AC2, AC3 |
| Note | Edit | Author only, `now - createdAt <= 24 h` at save time | "The edit window for this note has closed" | M10 AC11, edge 1 |
| KYB Licence | Licence number, issuing authority, expiry | 1 to 50; 1 to 120; expiry required unless "No expiry date" | "Enter the licence number" (proposal) | M12 AC2 |
| KYB Ownership | Summary, parent name | Summary 1 to 2,000 required; parent name optional max 200 | | M12 AC4 |
| KYB Sanctions | Result, lists | Result required; lists 1 to 200 | | M12 AC5 |
| KYB (all) | Verified on | Default today; not after today; not after the expiry date | "Verified on cannot be in the future" (proposal); "Verified on cannot be after the expiry date" (proposal) | M12 AC6 |
| KYB (all) | Evidence link | Required, `checkDocLink` = ok. An existing link on a host no longer approved shows a warning; the next save requires an approved link | "Use a link to approved document storage"; warning "Link outside approved storage" | M12 AC6, AC7, edge 6 |
| Review | Status, dates | Client may send PLANNED, IN_PROGRESS or complete; OVERDUE is rejected. Next review date required once a status is set. Complete: completion date not after today, new next date later than it | "Next review date must be after the completion date" (proposal) | M12 AC11, AC12 |
| Obligations | Incident notification time | Optional, whole number 1 to 720 | "Enter a whole number of hours between 1 and 720" | M13 AC2, AC4 |
| Obligations | Subprocessor change notice | Optional, whole number 0 to 365 | "Enter a whole number of days between 0 and 365" (proposal) | M13 AC2 |
| Obligations | Audit right | Optional Yes / No | | M13 AC2 |
| Obligations | Availability SLA | Optional, 90.00 to 100.00, max 2 decimals | "Enter a percentage between 90.00 and 100.00" (proposal) | M13 AC2 |
| Obligations | EU VoP, UK CoP status | Optional enum `SchemeAdherence` | | M13 AC2 |
| Obligations | Agreement expiry date | Optional valid date, past allowed | "Enter a valid date" (proposal) | M13 AC2 |
| Obligations | Contract PDF link | Optional, `checkDocLink` = ok when present | "Use a link to approved document storage" | M13 AC2 |
| Billing | Legal name, street, city, postal code | Optional at save; when present 2 to 200, 1 to 200, 1 to 100, 1 to 20 | "Must be 2 to 200 characters" (proposal) | M14 AC1, AC5 |
| Billing | Country | Optional, ISO | | M14 AC1 |
| Billing | VAT / tax ID | Optional; `normaliseVat` then `checkVat(vat, billing country)` | "VAT ID must start with DE for Germany" | M14 AC2, edge 3 |
| Billing | LEI | Optional; `isValidLei`. Differs from entity LEI: non-blocking warning | "LEI must be 20 characters and pass the check digit test"; warning "Differs from entity LEI 549300URJH9VSI58CS32" | M14 AC3, AC4, edge 2 |
| Billing | Contracting Corvane entity | One of `CORVANE_CONTRACTING_ENTITIES`; a stored value no longer in the list is kept, shown with "No longer in list" and counts as invalid for the flag | | M14 AC1, edge 5 |
| User | Name, email, team | All required; email `EMAIL_RE`, unique case-insensitive | "Enter a valid email address"; "A user with this email already exists" | M15 AC6 |
| User | Team change | The admin cannot change their own team | "The admin must stay on the Ops team in this version." | M15 edge 1 |

#### 3.4.3 Issue flow field rules

One Zod schema per issue action in `src/lib/validation/issues.ts`, used by the forms and the services as in 3.4. Copy in double quotes is exact (Appendix B).

| Object | Field | Rule | Error copy | AC |
|---|---|---|---|---|
| Report | Affected entity | Entity record: the record itself, not soft-deleted. Group record: at least one ticked active member | "Select at least one affected entity" | M17 AC2, AC4, AC13 |
| Report | Type | Required, one of the 8 types | "Select the issue type" | M17 AC2, AC3 |
| Report | Product line | Optional, a non-cancelled line of the entity; sets and locks scheme and country. Hidden on partner-only entities | | M17 AC2, edge case 1 |
| Report | Scheme, country | Required for SERVICE_UNAVAILABLE, PARTNER_DEGRADED, WRONG_MATCH, INTEGRATION_BLOCKER; optional otherwise; both or neither. PARTNER_DEGRADED on a partner: a non-Retired coverage row of that partner | "Select the scheme and country affected"; "<entity> has no coverage for <scheme> / <country>" | M17 AC2, AC3, M23 AC1 |
| Report | Description | Required, 20 to 5,000, line breaks kept | "Describe the issue in 20 to 5,000 characters" | M17 AC3 |
| Report | Corvane aware at | Required, default now, not in the future (server `now()`); entered in the reporter's time zone | "Corvane aware at cannot be in the future" | M17 AC3, AC13 |
| Report | Reported at the customer by | Required: active contact of the entity, "Someone else" with a name of 1 to 120, or "Found by Corvane" | "Select who reported it, or choose Found by Corvane" | M17 AC2, AC3 |
| Report | Impact | Required, one of 4 | "Select the impact" | M17 AC3 |
| Report | Possible data breach | Required Yes or No, no default | "Answer Yes or No" | M17 AC3 |
| Report | Reporter | Always the session user; any `reporter` or `severity` in the body is ignored | server validation error for "Monitoring (automatic)" | M17 AC1, AC13, M19 AC1 |
| Add to existing | Target issue | Status New, In progress, Waiting on customer or Waiting on partner at save time; all report fields valid | "ISS-1038 is no longer open. Report a new issue instead." | M17 AC6, edge case 8 |
| Description edit | Description | Reporter only, status New; 20 to 5,000 | as above | M17 AC11 |
| Change severity | New severity, reason | Differs from current; reason 10 to 500; Sev-1 and Sev-2 refused under the pre-go-live cap, Sev-1 refused on BILLING and COMMERCIAL_COVERAGE, unless possible breach | "Sev-3 is the maximum before go-live"; "Highest severity for this type: Sev-2" | M19 AC13 |
| Change type | New type, reason | Differs from current; reason 10 to 500; a capped type with Sev-1 and no breach sets Sev-2 | "Highest severity for this type: Sev-2" | M19 AC17, AC18 |
| Change status | Status, note | Issue acknowledged; In progress, Waiting on customer or Waiting on partner, current disabled; note 0 to 500 | "Acknowledge the issue first" (tooltip) | M21 AC2, AC3 |
| Resolve | Root cause, solution | Each 20 to 2,000 | "Enter at least 20 characters" | M21 AC4 |
| Back to work | Reason | From Resolved to In progress, 10 to 500 | "Reason must be 10 to 500 characters" (proposal) | M21 AC5 |
| Contributor | User | Active user of any team; not the owner or the communicator | "Already on this issue" (picker label) | M21 AC6 |
| Reassign | New owner, reason | Active user of the owner team, different from the current owner; reason 10 to 500 | "Current owner" (picker label) | M21 AC8, edge case 4 |
| Issue note | Body | 1 to 5,000, plain text | "Enter a note" (proposal) | M21 AC7 |
| Record notification or update | Type | "First notification" (default while the notification clock runs) or "Update"; R2 adds "Facts pack sent" and "Breach notification" while their clocks run | | M22 AC6, AC13 |
| Record notification or update | Time | Required, default now, not in the future, not before Corvane aware at | "The time can't be before Corvane aware at (21:12 CEST)" | M22 AC6, edge case 3 |
| Record notification or update | Channel, person, message | Channel one of 4; person an active contact of the entity (Incident contacts first) or free text 1 to 120; message 10 to 5,000, prefilled with the template body on Email | "Message must be 10 to 5,000 characters" (proposal) | M22 AC6, AC7 |
| Close | Person, channel, time, note | Person and channel required; time not in the future and not before "Resolved at"; note 0 to 500 | "The time can't be before Resolved at (<time>)" (proposal) | M22 AC11 |
| Compliance assessment | Outcome, rationale | One of 3; rationale 10 to 1,000 | "Rationale must be 10 to 1,000 characters" (proposal) | M25 AC6 |
| Linked issues | Rows | At least one row ticked; per row "Create a new linked issue" or "Attach ISS-<id>" of an open issue on the same entity, scheme and country | | M23 AC7, AC8 |
| Unlink | Reason | 5 to 500 | "Reason is required (5 to 500 characters)" (proposal) | M23 AC14 |
| Obligations (Customer agreement) | Regulatory regime | Optional enum; "Other" requires a regime name 2 to 100 | "Enter the regime name" | M26 AC2 |
| Obligations (Customer agreement) | Regulator's deadline | Optional, 0 to 300 | | M26 AC2 |
| Obligations (Customer agreement) | Facts needed within (hours) | Optional whole number 1 to 72; disabled and cleared when the regime is None | "Enter a whole number of hours between 1 and 72" | M26 AC2, AC4 |
| Obligations (Customer agreement) | Post-incident report due (days) (R2) | Optional whole number 1 to 90; disabled and cleared when the regime is None | "Enter a whole number of days between 1 and 90" | M26 AC2, AC9 |
| Reopen (R2) | Reason | 10 to 500; fewer than 10 business days since "Closed at" | "Reason must be 10 to 500 characters" (proposal) | M22 AC15 |
| Take over (R2) | Reason | 10 to 500; communicator absent; user in Customer Success; not on partner-only entities | as above | M22 AC17 |
| Record report sent (R2) | Sent on, sent to, channel, link, summary | Sent on not in the future, not before resolution; active Customer-context contact; channel one of 4; link optional `checkDocLink`, max 2,048; summary 10 to 2,000 | "Use a link to approved document storage"; "No active customer contact. Add one in Contacts" | M27 AC5, edge case 5 |

### 3.5 GLEIF integration

#### 3.5.1 Endpoints

All calls use `GET` with header `Accept: application/vnd.api+json` against `GLEIF_BASE_URL` (`https://api.gleif.org/api/v1`). No API key.

| Call | Path | 200 | 404 |
|---|---|---|---|
| LEI record | `/lei-records/{LEI}` | `data` = the record | LEI not found |
| Direct parent | `/lei-records/{LEI}/direct-parent` | `data` = the parent's LEI record | No direct parent reported |
| Ultimate parent | `/lei-records/{LEI}/ultimate-parent` | `data` = the ultimate parent's LEI record | No ultimate parent reported |

The three requests run in parallel with one `AbortController` and a total budget of `GLEIF_TIMEOUT_MS` (5,000 ms).

#### 3.5.2 Client contract (`src/server/gleif/client.ts`)

```ts
export type GleifParent = { lei: string; legalName: string; country: string }; // country = headquarters
export type GleifRecord = {
  lei: string;
  legalName: string;               // attributes.entity.legalName.name
  legalAddressCountry: string;     // attributes.entity.legalAddress.country
  headquartersCountry: string;     // attributes.entity.headquartersAddress.country
  registrationStatus: string;      // attributes.registration.status (raw)
  nextRenewalDate: string;         // attributes.registration.nextRenewalDate, first 10 chars
  entityStatus: string;            // attributes.entity.status
  successorLei: string | null;     // attributes.entity.successorEntity.lei ?? attributes.entity.successorEntities[0]?.lei ?? null
  directParent: GleifParent | null;
  ultimateParent: GleifParent | null;
};
export type GleifLookup =
  | { kind: "found"; source: "LIVE" | "CACHE"; fetchedAt: string; record: GleifRecord; parentsUnavailable: boolean }
  | { kind: "not_found" }
  | { kind: "unavailable" };
export async function lookupLei(lei: string): Promise<GleifLookup>;
```

Decision flow:

1. `GLEIF_FORCE_CACHE=true`: answer from the cache, or `unavailable` when the LEI is not cached.
2. Record call returns 200: `found`, `source = LIVE`, `fetchedAt = now`. Parent calls: 200 maps to the parent, 404 maps to `null`. A parent call that times out or fails takes that parent from the cache when the LEI is cached, otherwise `null` with `parentsUnavailable = true`.
3. Record call returns 404: `not_found`. A live 404 is authoritative; the cache is not consulted.
4. Record call times out, fails on the network, or returns 429 or 5xx: answer from the cache with `source = CACHE` and `fetchedAt = cache.capturedAt` when the LEI is cached (UI tag "From GLEIF (cached copy, <date>)"), otherwise `unavailable` (M2 error state, Shared conventions "GLEIF in the demo").

#### 3.5.3 Mapping to stored fields

| GLEIF value | Entity field | Group field (parent LEI lookup) |
|---|---|---|
| `legalName` | Wizard pre-fills `legalName`; always stored in `gleifLegalName` | `parentLegalName` |
| `legalAddressCountry` | Wizard pre-fills `country` (M2 AC6); stored in `gleifCountry` | |
| `headquartersCountry` | | `hqCountry` pre-fill |
| `registrationStatus` | `leiStatus` (table 3.5.4) and raw value in `gleifRawStatus` | `parentLeiStatus` |
| `nextRenewalDate` | `leiNextRenewalDate` (LEI KYB expiry, M12 AC3) | |
| `successorLei` | `gleifSuccessorLei` ("Use successor LEI <LEI>") | |
| `directParent` | `gleifDirectParentLei`, `gleifDirectParentName` | |
| `ultimateParent` | `gleifUltimateParentLei`, `gleifUltimateParentName` | |
| lookup time and source | `gleifCheckedAt`, `gleifSource` (`LIVE`, `CACHE`, or `MANUAL` when entered by hand) | `parentGleifCheckedAt` |

Group suggestion (M2 AC8): compare `ultimateParent.lei` (fall back to `directParent.lei` when there is no ultimate parent) with `Group.parentLei` of non-deleted groups. Match: pre-select with "Suggested from GLEIF parent". No match and a parent exists: offer "Create group from GLEIF parent" with name = parent legal name, parent LEI, HQ country = parent headquarters country; the group is created in the submit transaction (M3 AC10, resolution 27). The Santander Consumer Bank S.p.A. case works because its ultimate parent is Banco Santander S.A. while its direct parent is Open Bank (resolution table).

Display: GLEIF returns many legal names in upper case (for example "LLOYDS BANK PLC"). The wizard pre-fills the name exactly as GLEIF returns it and the user may edit it. Seeded entities store the display names from the Demo institutions table in `legalName` and the GLEIF value in `gleifLegalName`.

#### 3.5.4 Status handling

| GLEIF `registration.status` | `leiStatus` | Wizard behaviour (M2 AC7) | Badge | LEI KYB check | Compliance worklist |
|---|---|---|---|---|---|
| ISSUED | ISSUED | No warning | "Issued" green | By renewal date | By renewal date buckets |
| LAPSED | LAPSED | Amber "LEI lapsed on <nextRenewalDate>"; continue | "LEI lapsed" amber | Expired | Overdue, "LEI lapsed in GLEIF" (M11 AC13, edge 2) |
| RETIRED, MERGED, ANNULLED, DUPLICATE | same value | Red "This LEI is no longer valid for this entity"; "Use successor LEI <LEI>" when `successorLei`; else reason 10 to 500, saved to History as "LEI status override: <reason>" | status label, red | Expired | Overdue |
| PENDING_TRANSFER, PENDING_ARCHIVAL | same value | Amber "LEI status: Pending transfer" / "LEI status: Pending archival"; continue | amber | By renewal date | By renewal date buckets |
| Any other value (for example PENDING_VALIDATION, CANCELLED, TRANSFERRED) | NOT_VERIFIED, raw value kept in `gleifRawStatus` | Amber "LEI status: <raw value>"; continue | "Not verified with GLEIF" neutral | By renewal date | By renewal date buckets |
| `not_found` | NOT_VERIFIED, `gleifRawStatus = "NOT_FOUND"` | "No GLEIF record for <LEI>. Check the LEI with the customer."; manual entry with reason (resolution 28) | "Not verified with GLEIF" | Expired, "LEI not found in GLEIF" (M12 error state) | Overdue |
| `unavailable` | NOT_VERIFIED, `gleifSource = MANUAL` | "GLEIF is unavailable. You can retry or enter the legal name and country manually." | "Not verified with GLEIF" | By stored renewal date, if any | as stored |

#### 3.5.5 Where GLEIF is called

| Trigger | Who | Effect |
|---|---|---|
| Wizard step 1: LEI blur or "Look up" | Sales | Fills step 1 (M2 AC5); nothing stored until submit |
| Details tab: LEI changed | Ops | Re-runs lookup and duplicate check, same panels as the wizard (resolution 54) |
| Header "Retry GLEIF lookup" (only when `leiStatus = NOT_VERIFIED`) | Ops | Updates GLEIF fields; audit `source = SYSTEM_GLEIF` |
| Compliance tab "Refresh from GLEIF" | Compliance | Updates `leiStatus`, `leiNextRenewalDate`, `gleifCheckedAt`; audit `source = SYSTEM_GLEIF`, `userId` = requesting user, rendered "System (GLEIF), requested by Mei Chen" (M12 AC3, AC14). `unavailable`: 503, nothing changes, card shows "GLEIF unavailable, showing data from <gleifCheckedAt>" |
| Group create or edit with a parent LEI | Ops | Fills parent name and HQ country; `unavailable` saves `parentLeiStatus = NOT_VERIFIED` (M4 error state) |
| Seed and Reset demo data | System | Fills the GLEIF fields of every seeded entity with `lookupLei` (live first, cache fallback). LEI status and renewal dates are never hard-coded |

#### 3.5.6 Cached copy (`data/gleif-cache.json`)

Format: one object keyed by LEI, each value a `GleifRecord`. It holds the 13 scenario LEIs, the 2 parents the demo touches (UniCredit S.p.A., Open Bank S.A.) and the 6 filler LEIs of 7.1.3 (Nordea Bank Abp, ING-DiBa AG, OCBC, Bank of Ireland, Česká spořitelna, Raiffeisen Bank International; their values are in the 7.2.4 table, re-verified on GLEIF on 3 October 2026). `npm run gleif:snapshot` rewrites it from the live API with the same LEI list. Values below were captured from the live API on 3 October 2026; add the 6 filler records in the same shape.

```json
{
  "capturedAt": "2026-10-03T00:00:00Z",
  "source": "https://api.gleif.org/api/v1",
  "records": {
    "5493006QMFDDMYWIAM13": {"lei": "5493006QMFDDMYWIAM13", "legalName": "BANCO SANTANDER S.A.", "legalAddressCountry": "ES", "headquartersCountry": "ES", "registrationStatus": "ISSUED", "nextRenewalDate": "2027-06-09", "entityStatus": "ACTIVE", "successorLei": null, "directParent": null, "ultimateParent": null},
    "PTCQB104N23FMNK2RZ28": {"lei": "PTCQB104N23FMNK2RZ28", "legalName": "SANTANDER UK PLC", "legalAddressCountry": "GB", "headquartersCountry": "GB", "registrationStatus": "ISSUED", "nextRenewalDate": "2027-04-08", "entityStatus": "ACTIVE", "successorLei": null, "directParent": {"lei": "549300F5XIFGNNW4CF72", "legalName": "SANTANDER UK GROUP HOLDINGS PLC", "country": "GB"}, "ultimateParent": {"lei": "5493006QMFDDMYWIAM13", "legalName": "BANCO SANTANDER S.A.", "country": "ES"}},
    "549300URJH9VSI58CS32": {"lei": "549300URJH9VSI58CS32", "legalName": "BANCO SANTANDER TOTTA, S.A.", "legalAddressCountry": "PT", "headquartersCountry": "PT", "registrationStatus": "ISSUED", "nextRenewalDate": "2027-06-23", "entityStatus": "ACTIVE", "successorLei": null, "directParent": {"lei": "5493006QMFDDMYWIAM13", "legalName": "BANCO SANTANDER S.A.", "country": "ES"}, "ultimateParent": {"lei": "5493006QMFDDMYWIAM13", "legalName": "BANCO SANTANDER S.A.", "country": "ES"}},
    "549300O0YQXDOJB36Y73": {"lei": "549300O0YQXDOJB36Y73", "legalName": "SANTANDER CONSUMER BANK S.P.A.", "legalAddressCountry": "IT", "headquartersCountry": "IT", "registrationStatus": "ISSUED", "nextRenewalDate": "2027-09-08", "entityStatus": "ACTIVE", "successorLei": null, "directParent": {"lei": "5493000LM0MZ4JPMGM90", "legalName": "OPEN BANK SOCIEDAD ANONIMA", "country": "ES"}, "ultimateParent": {"lei": "5493006QMFDDMYWIAM13", "legalName": "BANCO SANTANDER S.A.", "country": "ES"}},
    "5299000I7Y60A8273788": {"lei": "5299000I7Y60A8273788", "legalName": "Santander Consumer Bank GmbH", "legalAddressCountry": "AT", "headquartersCountry": "AT", "registrationStatus": "ISSUED", "nextRenewalDate": "2027-08-27", "entityStatus": "ACTIVE", "successorLei": null, "directParent": {"lei": "5493006QMFDDMYWIAM13", "legalName": "BANCO SANTANDER S.A.", "country": "ES"}, "ultimateParent": {"lei": "5493006QMFDDMYWIAM13", "legalName": "BANCO SANTANDER S.A.", "country": "ES"}},
    "549300Z5VU00GHU3B005": {"lei": "549300Z5VU00GHU3B005", "legalName": "BANCO SANTANDER CONSUMER PORTUGAL S.A.", "legalAddressCountry": "PT", "headquartersCountry": "ES", "registrationStatus": "LAPSED", "nextRenewalDate": "2021-11-12", "entityStatus": "ACTIVE", "successorLei": null, "directParent": {"lei": "5493000LM0MZ4JPMGM90", "legalName": "OPEN BANK SOCIEDAD ANONIMA", "country": "ES"}, "ultimateParent": {"lei": "5493006QMFDDMYWIAM13", "legalName": "BANCO SANTANDER S.A.", "country": "ES"}},
    "H7FNTJ4851HG0EXQ1Z70": {"lei": "H7FNTJ4851HG0EXQ1Z70", "legalName": "LLOYDS BANK PLC", "legalAddressCountry": "GB", "headquartersCountry": "GB", "registrationStatus": "ISSUED", "nextRenewalDate": "2027-04-29", "entityStatus": "ACTIVE", "successorLei": null, "directParent": {"lei": "549300PPXHEU2JF0AM85", "legalName": "LLOYDS BANKING GROUP PLC", "country": "GB"}, "ultimateParent": {"lei": "549300PPXHEU2JF0AM85", "legalName": "LLOYDS BANKING GROUP PLC", "country": "GB"}},
    "J4CP7MHCXR8DAQMKIL78": {"lei": "J4CP7MHCXR8DAQMKIL78", "legalName": "BANCA MONTE DEI PASCHI DI SIENA S.P.A.", "legalAddressCountry": "IT", "headquartersCountry": "IT", "registrationStatus": "ISSUED", "nextRenewalDate": "2027-09-29", "entityStatus": "ACTIVE", "successorLei": null, "directParent": null, "ultimateParent": null},
    "213800QW7QJVVCL9RZ56": {"lei": "213800QW7QJVVCL9RZ56", "legalName": "ZOPA BANK LIMITED", "legalAddressCountry": "GB", "headquartersCountry": "GB", "registrationStatus": "ISSUED", "nextRenewalDate": "2027-04-28", "entityStatus": "ACTIVE", "successorLei": null, "directParent": {"lei": "213800CH9Q31TMDRXN75", "legalName": "ZOPA GROUP PLC", "country": "GB"}, "ultimateParent": {"lei": "213800CH9Q31TMDRXN75", "legalName": "ZOPA GROUP PLC", "country": "GB"}},
    "2ZCNRR8UK83OBTEK2170": {"lei": "2ZCNRR8UK83OBTEK2170", "legalName": "UNICREDIT BANK GMBH", "legalAddressCountry": "RO", "headquartersCountry": "RO", "registrationStatus": "ISSUED", "nextRenewalDate": "2026-10-22", "entityStatus": "ACTIVE", "successorLei": null, "directParent": {"lei": "549300TRUWO2CD2G5692", "legalName": "ERSTE GROUP BANK AG", "country": "AT"}, "ultimateParent": {"lei": "549300TRUWO2CD2G5692", "legalName": "ERSTE GROUP BANK AG", "country": "AT"}},
    "724500973ODKK3IFQ447": {"lei": "724500973ODKK3IFQ447", "legalName": "ADYEN N.V.", "legalAddressCountry": "RO", "headquartersCountry": "RO", "registrationStatus": "ISSUED", "nextRenewalDate": "2027-07-18", "entityStatus": "ACTIVE", "successorLei": null, "directParent": null, "ultimateParent": null},
    "213800MQORWPL582SW82": {"lei": "213800MQORWPL582SW82", "legalName": "REVOLUT LTD", "legalAddressCountry": "GB", "headquartersCountry": "GB", "registrationStatus": "ISSUED", "nextRenewalDate": "2027-04-25", "entityStatus": "ACTIVE", "successorLei": null, "directParent": {"lei": "213800UIKMYZWWQS5E02", "legalName": "REVOLUT GROUP HOLDINGS LTD", "country": "GB"}, "ultimateParent": {"lei": "213800UIKMYZWWQS5E02", "legalName": "REVOLUT GROUP HOLDINGS LTD", "country": "GB"}},
    "213800PLUYXGZ8LU7T61": {"lei": "213800PLUYXGZ8LU7T61", "legalName": "MONZO BANK LTD", "legalAddressCountry": "GB", "headquartersCountry": "GB", "registrationStatus": "ISSUED", "nextRenewalDate": "2027-02-27", "entityStatus": "ACTIVE", "successorLei": null, "directParent": {"lei": "213800WIZ7R66OO87N21", "legalName": "MONZO BANK HOLDING GROUP LIMITED", "country": "GB"}, "ultimateParent": {"lei": "213800WIZ7R66OO87N21", "legalName": "MONZO BANK HOLDING GROUP LIMITED", "country": "GB"}},
    "549300TRUWO2CD2G5692": {"lei": "549300TRUWO2CD2G5692", "legalName": "ERSTE GROUP BANK AG", "legalAddressCountry": "AT", "headquartersCountry": "AT", "registrationStatus": "ISSUED", "nextRenewalDate": "2027-10-03", "entityStatus": "ACTIVE", "successorLei": null, "directParent": null, "ultimateParent": null},
    "5493000LM0MZ4JPMGM90": {"lei": "5493000LM0MZ4JPMGM90", "legalName": "OPEN BANK SOCIEDAD ANONIMA", "legalAddressCountry": "ES", "headquartersCountry": "ES", "registrationStatus": "ISSUED", "nextRenewalDate": "2027-02-15", "entityStatus": "ACTIVE", "successorLei": null, "directParent": {"lei": "5493006QMFDDMYWIAM13", "legalName": "BANCO SANTANDER S.A.", "country": "ES"}, "ultimateParent": {"lei": "5493006QMFDDMYWIAM13", "legalName": "BANCO SANTANDER S.A.", "country": "ES"}}
  }
}
```

Facts from this capture that the demo depends on: Banco Santander Consumer Portugal S.A. is LAPSED (scenario 3); Adyen's renewal (2027-07-18) sits outside the 90-day window (scenarios decision 7); Santander Consumer Bank GmbH's ultimate parent is Banco Santander S.A. (scenario 1). UniCredit Bank GmbH renews on 2026-10-22, so on a demo day in October 2026 its LEI check shows Expiring and the Compliance worklist lists it under ≤30 days. Run `npm run gleif:snapshot` and `npm run db:reset` the day before the demo.

### 3.6 Duplicate check

Module `src/server/duplicates.ts`, endpoint `POST /api/duplicates/check`. Triggers (M2 AC9): GLEIF lookup completes, a BIC is added, the legal name or an alias changes (debounced 400 ms on the client); also on the Details tab when Ops changes the LEI, BICs, legal name or aliases (resolution 54). The submit re-runs the check on the server: if matches exist and no valid acknowledgement is sent, it returns 400.

#### 3.6.1 Normalisation (`src/lib/validation/normalise.ts`)

```ts
const CHAR_MAP: Record<string, string> = { "ß": "ss", "æ": "ae", "œ": "oe", "ø": "o", "ł": "l", "đ": "d", "ı": "i" };

// Used for search (legal forms kept): stored in legalNameSearch / aliasSearch
export function normaliseSearch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ßæœøłđı]/g, (c) => CHAR_MAP[c])
    .normalize("NFD").replace(/\p{M}/gu, "")      // ă→a, â→a, î→i, ș→s, ț→t, ü→u
    .replace(/\./g, "")                           // "s.p.a." → "spa", "b.v." → "bv"
    .replace(/[^\p{L}\p{N}]+/gu, " ")             // all other punctuation → space
    .trim()
    .replace(/\s+/g, " ");
}

// Legal forms from resolution 7, after normaliseSearch: plc, SA, S.A., S.p.A., AG, Ltd, DAC, B.V., N.V., GmbH
const LEGAL_FORMS = new Set(["plc", "sa", "spa", "ag", "ltd", "dac", "bv", "nv", "gmbh"]);

// Used for duplicates: stored in legalNameCore / aliasCore
export function normaliseCore(s: string): string {
  const t = normaliseSearch(s).split(" ").filter(Boolean);
  // join trailing single letters: "s a" → "sa", "n v" → "nv"
  let i = t.length;
  while (i > 0 && t[i - 1].length === 1) i--;
  const tokens = t.length - i >= 2 ? [...t.slice(0, i), t.slice(i).join("")] : t;
  while (tokens.length > 1 && LEGAL_FORMS.has(tokens[tokens.length - 1])) tokens.pop();
  return tokens.join(" ");
}
```

Examples (unit tests): "Santander Consumer Bank GmbH" and "Santander Consumer Bank S.p.A." both give `santander consumer bank`; "Banca Comerciala Romana S.A." and "UniCredit Bank GmbH" both give `banca comerciala romana`; "Banco Santander Totta, S.A." gives `banco santander totta`.

`legalNameSearch`, `legalNameCore`, `aliasSearch` and `aliasCore` are written by the service on every create or edit of a name or alias. The seed uses the same functions.

#### 3.6.2 Algorithm

Input: `{ lei?, bics: string[], legalName?, aliases: string[], excludeEntityId? }`. Output: up to 5 matches.

1. `cores = unique(normaliseCore(legalName), aliases.map(normaliseCore))`, empty strings removed. `bic8s = unique(bics.map(b => b.slice(0, 8)))`.
2. Run four queries over **all** entities, soft-deleted included (M2 AC9, M16 edge 3), excluding `excludeEntityId`:

```sql
-- Q1 LEI
SELECT id, 'LEI' AS reason, 1.0 AS score FROM "Entity" WHERE lei = $lei;

-- Q2 BIC (any BIC with the same first 8 characters)
SELECT DISTINCT b."entityId" AS id, 'BIC' AS reason, 1.0 AS score
FROM "EntityBic" b WHERE b.bic8 = ANY($bic8s);

-- Q3 Name, exact after normalisation (legal name or alias)
SELECT id, 'NAME' AS reason, 1.0 AS score FROM "Entity" WHERE "legalNameCore" = ANY($cores)
UNION
SELECT "entityId", 'NAME', 1.0 FROM "EntityAlias" WHERE "aliasCore" = ANY($cores);

-- Q4 Name, trigram similarity (inside the same transaction)
SELECT set_config('pg_trgm.similarity_threshold', $threshold::text, true);  -- DUPLICATE_NAME_THRESHOLD, transaction-local
SELECT e.id, 'NAME' AS reason, max(similarity(e."legalNameCore", c)) AS score
FROM "Entity" e, unnest($cores::text[]) c
WHERE e."legalNameCore" % c GROUP BY e.id
UNION ALL
SELECT a."entityId", 'NAME', max(similarity(a."aliasCore", c))
FROM "EntityAlias" a, unnest($cores::text[]) c
WHERE a."aliasCore" % c GROUP BY a."entityId";
```

3. Merge by entity id. Keep every reason per entity; the card shows the strongest reason chip in the order LEI, BIC, Name.
4. Sort: LEI matches first, then BIC, then Name by score descending, then legal name. Keep the first 5 (M2 AC11).
5. Hydrate each match: legal name, country, LEI, roles, owner (name, team), lifecycle state, `deletedAt`.
6. Panel rules:
   - A soft-deleted match shows "A deleted record with this LEI exists. Ask the admin to reactivate it." (LEI reason) or "A deleted record with a similar name exists. Ask the admin to reactivate it." (BIC or Name reason, proposal), with name and deletion date, and an "Open record" link only for the admin (M2 edge 5).
   - An LEI match whose entity has an active Partner role and no active Customer role returns `addCustomerRoleCandidate: entityId`; the panel's main action is "Add Customer role to this existing entity" (M2 AC13).
   - Matches never block: the submit needs the checkbox and a reason of 10 to 500 characters, saved as History "Duplicate warning acknowledged: <reason>" and as an audit entry on the new entity (M2 AC12, AC17, AC18).
7. Reactivation (M16 AC15): before reactivating, run Q1 with the deleted entity's LEI against active entities only; a hit requires the reactivation reason.

### 3.7 Search

Module `src/server/queries/search.ts`. One raw SQL query (via `db.$queryRaw` with tagged parameters) returns the ids for one page plus the total count; Prisma then hydrates those 25 ids. Typeahead (`GET /api/search/typeahead?q=`) uses the same query with `LIMIT 5` and no filters.

#### 3.7.1 Query input

| Derived value | Rule |
|---|---|
| `qn` | `normaliseSearch(q)`; text matching runs only when `qn.length >= 2` (M1 AC2) |
| `qc` | `q` with spaces removed, uppercase; used for LEI, BIC and contract ID |
| Contract ID | When `qc` equals a `Contract.contractId` (case-insensitive), the search page redirects: group master agreement → `/groups/{groupId}`, entity contract → `/entities/{holderEntityId}` (M1 AC18, resolution 24). The typeahead shows it as a row "Contract IPE-MSA-2026-014 · Santander" |

#### 3.7.2 Matching and relevance (M1 AC2 to AC4, AC9)

| Rank | Match | SQL condition |
|---|---|---|
| 1 | Exact LEI | `e.lei = qc` (20 characters) |
| 1 | Exact BIC | `b.bic = qc` (11 characters) or `b.bic8 = qc` (8 characters, returns every BIC11 starting with it) |
| 2 | Exact name or alias | `e."legalNameSearch" = qn` or `a."aliasSearch" = qn` |
| 3 | Partial name or alias | `e."legalNameSearch" LIKE '%' || qn || '%'` or the same on `a."aliasSearch"` (diacritics and case removed by `normaliseSearch`; the trigram GIN indexes serve `LIKE`) |
| 3 | Partial LEI | `length(qc) >= 4 AND e.lei LIKE qc || '%'` |

`rank = LEAST(...)` over the conditions that hold (Postgres `LEAST` ignores nulls). Rows with no rank are dropped when a query is present. "Matched alias: <alias>" is returned when an alias matched and the legal name did not; with several matching aliases, the exact one wins, then alphabetical. Escape `%`, `_` and `\` in `qn` before building the `LIKE` pattern.

#### 3.7.3 Filters (M1 AC5 to AC7, AC10, M5 AC16)

AND across filter types, OR inside one type. Every query has `e."deletedAt" IS NULL` (M1 AC10, M16 AC10).

```sql
-- product side: same product line must match country, scheme and stage (resolution 19)
prod_match := cr.active AND EXISTS (
  SELECT 1 FROM "ContractedProduct" p
  WHERE p."entityId" = e.id AND p."cancelledAt" IS NULL
    AND (cardinality($countries) = 0 OR p.country = ANY($countries))
    AND (cardinality($schemes)   = 0 OR p.product = ANY($schemes))
    AND (cardinality($stages)    = 0 OR p.stage   = ANY($stages)))

-- coverage side: same coverage row must match country, scheme and current status
cov_match := pr.active AND EXISTS (
  SELECT 1 FROM "PartnerCoverage" c
  JOIN LATERAL (
    SELECT s.status FROM "CoverageStatusChange" s
    WHERE s."coverageId" = c.id AND s."effectiveDate" <= $today
    ORDER BY s."effectiveDate" DESC, s."createdAt" DESC LIMIT 1) cur ON true
  WHERE c."partnerRoleId" = pr.id
    AND (cardinality($countries) = 0 OR c.country = ANY($countries))
    AND (cardinality($schemes)   = 0 OR c.scheme  = ANY($schemes))
    AND (CASE WHEN cardinality($covStatuses) = 0 THEN cur.status <> 'RETIRED'
              ELSE cur.status = ANY($covStatuses) END))
```

| Filters set | Entity matches when |
|---|---|
| Stage filter | `prod_match` |
| Coverage status filter | `cov_match` |
| Both | `prod_match AND cov_match` |
| Country or scheme only | `prod_match OR cov_match` |
| None of the four | no product or coverage condition |
| Role = Customer / Network partner / Both | `cr.active` / `pr.active` / `cr.active AND pr.active` (resolution 18) |
| Lifecycle state | `e."lifecycleState" = ANY($lifecycle)`; when the URL has no `lifecycle` param the default is ONBOARDING, LIVE, BAU (resolution 20) |
| Owner | `e."ownerId" = ANY($owners) OR ($noOwner AND e."ownerId" IS NULL)` |

Products match on the customer record that holds the line (`entityId`), where the band lives (M6 AC21). Chips per row when a country, scheme, stage or coverage status filter is active: "Customer product" when `prod_match`, "Partner coverage" when `cov_match`, both on one row for a dual-role entity (M1 AC6, resolution 22). The coverage chip also shows the first matching row, ordered by scheme then country: "Partner coverage: GB / UK CoP Degraded since 02 Oct 2026" (M5 AC16).

Sort: `relevance` (default with a query: rank, then `lower("legalName")`), `name` (default without a query), `country` (then name), `lifecycle` (Onboarding, Live, BAU, Inactive, then name). Page size 25 with `LIMIT 25 OFFSET (page - 1) * 25` and `count(*) OVER ()` for "<n> institutions" (M1 AC19).

Hydrated row fields (M1 AC8): legal name, matched alias, type, country, LEI, LEI status badge, roles, group (name and id, or "Standalone entity"), owner (name, team, or "No owner"), lifecycle state, chips, and for partners the carmine "No active incident contact" when the Partner context has no active Incident contact (resolution 42).

#### 3.7.4 URL state

All state is in the query string and parsed with one Zod schema (`searchParamsSchema`); unknown or invalid values are dropped silently. Multi-values are comma-separated enum values.

| Param | Example | Meaning |
|---|---|---|
| `q` | `q=financial%20services` | Query text |
| `view` | `institutions` (default), `obligations` | View switch |
| `country` | `country=GB,IE` | ISO codes |
| `scheme` | `scheme=UK_COP` | `EU_VOP`, `UK_COP`, `GLOBAL_VALIDATION` |
| `role` | `role=partner` | `customer`, `partner`, `both` |
| `stage` | `stage=LIVE_HYPERCARE,RAMP_UP,BAU` | Stage enums |
| `coverage` | `coverage=DEGRADED` | Coverage status enums |
| `lifecycle` | `lifecycle=ONBOARDING,LIVE,BAU,INACTIVE` | Absent = default (all except Inactive) |
| `owner` | `owner=none,clx123` | User ids and `none` |
| `sort` | `relevance`, `name`, `country`, `lifecycle` | Institutions view |
| `page` | `page=2` | 1-based |
| `inMin`, `inMax`, `inEmpty` | `inMin=1&inMax=4`, `inEmpty=1` | Incident notice (hours) |
| `spMin`, `spMax`, `spEmpty` | `spMin=30`, `spEmpty=1` | Subprocessor notice (days) |
| `osort` | `sp_desc` (default), `sp_asc`, `in_asc`, `in_desc` | Obligations view |

Switching "View as" keeps the URL, so the filtered list survives the switch (scenario 2 step 6).

#### 3.7.5 Obligations view query (M13 AC9 to AC13, resolution 25)

One row per active role of each non-deleted entity: a Customer row when `customerRole.active`, a Partner row when `partnerRole.active`, each `LEFT JOIN "ObligationCard"` on `(entityId, kind)`. A role with no card yet is a row with every value "Not captured".

| Filter | Applies to | Condition |
|---|---|---|
| `q` | Both | Same text match as 3.7.2 on the entity |
| Role | Rows | Customer → Customer rows; Network partner → Partner rows; Both → both rows of entities holding both roles |
| Country | Customer rows | A non-cancelled product line of the entity in that country, same line as the stage filter (scenarios decision 4) |
| Country | Partner rows | A coverage row of the entity in that country with a current status other than Retired (or in the coverage filter) |
| Scheme | Both | Card status for that scheme is set and not `NOT_APPLICABLE`: EU VoP → `euVopStatus`, UK CoP → `ukCopStatus`; Global validation has no card field and matches nothing in this view |
| Stage | Customer rows only (Partner rows drop out) | Product line at that stage |
| Partner coverage status | Partner rows only (Customer rows drop out) | At least one coverage row of the entity with that current status |
| Lifecycle, owner | Both | As 3.7.3 |
| Incident notice min/max | Both | `incidentNoticeHours BETWEEN min AND max`; rows with no value excluded (M13 AC11) |
| Incident "Only rows where this is not captured" | Both | `incidentNoticeHours IS NULL`; min and max ignored and disabled |
| Subprocessor notice min/max, not captured | Both | Same on `subprocessorNoticeDays`; 0 renders "No advance notice required" and passes `min = 0` (M13 edge 1) |

Sort: `osort`, empty values always last (`NULLS LAST` both directions), ties by legal name, then Customer before Partner. Default `sp_desc` (M13 AC12). Count "<n> agreements". Page size 25. Expiry badge per row: "Expired" when `expiryDate < today`, "Expires in N days" when within 90 days (M13 AC7). Scenario 2 check: `country=GB&scheme=UK_COP&role=customer&view=obligations&osort=in_asc` returns Revolut Ltd 2 h, Santander UK plc 4 h, Lloyds Bank plc 8 h, Zopa Bank Limited "Not captured", "4 agreements"; Monzo Bank Ltd drops out because its UK CoP status is Not applicable.

### 3.8 API list

Conventions: every path is under `/api`. Responses and error codes as 3.1.3. "Who" is checked on the server against `permissions/matrix.ts`; any other caller gets 403. Every write rejects a soft-deleted entity with 410 except the two admin record actions. "Audit" means one `AuditEntry` per changed field in the write transaction (M16 AC1). "History" names the `HistoryEvent` category (3.3.3). Worklist effects are read-time consequences; nothing is written to a worklist.

#### 3.8.1 Reads

| Method and path | Who | Returns | AC |
|---|---|---|---|
| `GET /api/search` | All teams | Institutions or Obligations page per 3.7 | M1 AC2-AC10, AC19, M13 AC9-AC13 |
| `GET /api/search/typeahead?q=` | All teams | Up to 5 entities and contract matches | M1 AC13, S0 |
| `GET /api/gleif/{lei}` | Sales, Ops, Compliance | `GleifLookup` (3.5.2), stores nothing | M2 AC5 |
| `POST /api/duplicates/check` | Sales, Ops | Matches per 3.6 | M2 AC9-AC13 |
| `GET /api/worklist/{section}?scope=mine|team` | All teams (sections of the user's team) | One worklist section, loaded independently | M11 AC1-AC25 |
| `GET /api/entities/{id}/history?cursor&team&type&openItems` | All teams | 50 timeline items | M10 AC7-AC9 |
| `GET /api/entities/{id}/audit?field&user&from&to&cursor` | Compliance, admin | 50 audit entries; others 403 | M16 AC4-AC7 |
| `GET /api/admin/permissions` | Compliance, admin | The matrix from `matrix.ts`; others 403 | M15 AC13 |
| `GET /api/admin/users`, `GET /api/admin/users/changes` | Admin | Users; team change history | M15 AC5, AC14 |
| `GET /api/admin/deleted?q=` | Admin | Deleted entities | M16 AC12 |

Pages (server components) call the same query functions directly.

#### 3.8.2 Writes

| Action | Method and path | Input | Who | Side effects | AC |
|---|---|---|---|---|---|
| View as | `POST /api/demo/view-as` | `{ team }` | Anyone, `DEMO_MODE` only (404 otherwise) | Sets `ch_user` cookie to the team's primary user; no audit | M15 AC11, resolution 59 |
| Reset demo data | `POST /api/demo/reset` | `{}` | Admin, `DEMO_MODE` only (404 otherwise) | `db-admin`: `TRUNCATE` all tables except `DemoMeta` `RESTART IDENTITY CASCADE`, then `seed(db, today)`, then increment `DemoMeta.seedVersion` (7.2.3); the only path that removes audit entries | M16 AC16, resolution 4 |
| Create customer | `POST /api/customers` | Wizard steps 1 to 4: entity (or `existingEntityId` for "Add Customer role"), GLEIF result, `createGroupFromGleif`, duplicate ack, LEI override reason, country override flag, product lines, entities not in portal, commercial terms, SLAs, special terms, contacts, notes for Onboarding, `onboardingManagerId` | Sales | One transaction: optional group, entity (`ONBOARDING`, owner = Sales user, unless existing entity), aliases, BICs, customer role (`createdById`), products at Contract signed with entry date today, contacts (`lastVerifiedAt` today), Handoff `SALES_TO_OPS` `SENT` with snapshot. Audit per field set (Legal entity, Customer role, Product line, Contact, Handoff, Group), duplicate and override reasons. History: NETWORK_AND_STRUCTURE "Record created by <name> (Sales)", acknowledgements; STAGE_CHANGE "Product line added" per line; HANDOFF "Handoff sent to <OM> by <Sales user>". Worklists: OM "To pick up", Sales "Awaiting pickup", Ops "Required fields empty" | M2 AC12-AC19, M3 AC10, AC16, AC17 |
| Confirm pickup | `POST /api/handoffs/{id}/confirm` | `{ version }` | The named Ops recipient | Status CONFIRMED, `confirmedAt`; entity owner → recipient, `ownerSince` now. Audit Handoff status, Legal entity owner. History HANDOFF "Handoff confirmed by <OM>", "Owner changed from <Sales user> to <OM>" | M3 AC12, AC16, AC17, M9 AC12 |
| Change Onboarding Manager | `POST /api/handoffs/{id}/recipient` | `{ toUserId, version }` (active Ops user) | Sales, while `SENT` | `toUserId` updated. Audit Handoff recipient. History HANDOFF. Item moves to the new OM's "To pick up" | M3 AC13, edge 3, resolution 36 |
| Send Ops → CS handoff | `POST /api/entities/{id}/handoffs` | `{ toUserId, blockNotes[], commitments[], noOpenCommitments, confirmedContactIds[], noteForCsm }` | Ops; entity has a product at Ramp-up or BAU and no open Ops → CS handoff | Handoff `OPS_TO_CS` `SENT` with snapshot; confirmed contacts get `lastVerifiedAt` today in the same transaction; owner unchanged. Audit Handoff, Contact verification. History HANDOFF "Handoff to Customer Success sent to <CSM> by <Ops user>". Worklists: CSM "To pick up", sender "Awaiting acceptance"; a previous "Handoff declined" item leaves | M8 AC1-AC9, AC16, AC17, resolutions 34, 35, 38 |
| Accept | `POST /api/handoffs/{id}/accept` | `{ version }` | The named CSM while in CS | ACCEPTED, `acceptedAt`; owner → CSM. Audit status and owner. History HANDOFF "Handoff accepted by <CSM>. Owner: <old> → <CSM>" | M8 AC11, AC15-AC17 |
| Decline | `POST /api/handoffs/{id}/decline` | `{ reason, version }` | The named CSM while in CS | DECLINED, `declineReason`. Audit, History HANDOFF. Sender "Handoff declined" | M8 AC12, AC15-AC17 |
| Cancel | `POST /api/handoffs/{id}/cancel` | `{ reason, version }` | Any Ops user | CANCELLED, `cancelledById`, `cancelReason`. Audit, History HANDOFF | M8 AC13, AC15, resolution 33 |
| Edit entity core | `PATCH /api/entities/{id}` | `{ legalName, aliases, type, country, lei, bics, duplicateAck?, leiOverrideReason?, gleif?, version }` | Ops | Updates fields, search and core columns; a changed LEI stores the new GLEIF result. Audit per field. History OTHER_FIELD_CHANGES | M1 AC20, M2 AC16, AC17, resolution 54 |
| Retry or refresh GLEIF | `POST /api/entities/{id}/gleif-refresh` | `{}` | Ops (header retry, only when NOT_VERIFIED), Compliance (LEI card) | GLEIF fields updated; audit `source = SYSTEM_GLEIF`; 503 when unavailable. History OTHER_FIELD_CHANGES | M2 error state, M12 AC3, AC14 |
| Set group | `PUT /api/entities/{id}/group` | `{ groupId } \| { standalone: true }`, `confirmMove?`, `version` | Ops | `groupId`, `groupDecision`. Audit (old and new group). History NETWORK_AND_STRUCTURE "Linked to group", "Moved from <A> to <B>" | M4 AC3-AC5, AC13, AC14 |
| Set roles | `PUT /api/entities/{id}/roles` | `{ customer: boolean, partner: boolean, confirmed?, version }` | Ops | Creates or (de)activates `CustomerRole` / `PartnerRole`; removal with data returns 409 `needsConfirmation` with counts first. Audit, History NETWORK_AND_STRUCTURE "Role added: Network partner" | M4 AC7, AC8, AC14 |
| Set lifecycle | `POST /api/entities/{id}/lifecycle` | `{ inactive: boolean, reason?, version }` | Ops | INACTIVE, or recomputed from stages. Audit, History NETWORK_AND_STRUCTURE. Inactive entities leave every worklist | M15 AC3, M11 AC21, S4.9 |
| Delete record | `POST /api/entities/{id}/delete` | `{ reason }` | Admin | `deletedAt`, `deletedById`, `deleteReason`. Audit "Record status: Active → Deleted" with reason. Hidden everywhere | M16 AC8-AC10 |
| Reactivate | `POST /api/entities/{id}/reactivate` | `{ reason? }` | Admin | Clears the deleted marker; LEI conflict requires reason (3.6.2 step 7). Audit "Record status: Deleted → Active". History when a reason is given | M16 AC13, AC15, resolution 57 |
| Create group | `POST /api/groups` | `{ name, parentLei?, hqCountry }` | Ops | Group with GLEIF parent data. Audit (Group) | M4 AC6, AC13 |
| Edit group | `PATCH /api/groups/{id}` | same + `version` | Ops | Audit (Group) | M4 AC6, AC13 |
| Unlink entity | `DELETE /api/groups/{id}/members/{entityId}` | `{ version }` | Ops | `groupId = null`, `groupDecision = STANDALONE`. Audit, History NETWORK_AND_STRUCTURE | M4 AC5, AC13 |
| Attach or replace contract | `PUT /api/entities/{id}/contract` | `{ existingContractId } \| { contractId, title, signingDate, scope, invoicedEntityId, documentUrl }` | Ops | Creates `Contract` (holder = entity, group for a master agreement) or links an existing master agreement. Audit (Customer role, Contract). History "Contract <ID> attached" | M4 AC9, AC10, AC13, AC14, D1 |
| Detach contract | `DELETE /api/entities/{id}/contract` | `{ version }` | Ops | `contractId = null`. Audit, History | M4 AC13 |
| Edit contract | `PATCH /api/contracts/{id}` | `{ title, signingDate, invoicedEntityId, documentUrl, version }` | Ops | Audit (Contract). History on every entity using it, including "Invoiced entity changed to <entity>"; billing flags recompute | M4 AC10, AC13, AC14 |
| Renewal date | `PUT /api/entities/{id}/renewal-date` | `{ renewalDate, note?, version }` | CS | Audit, History OTHER_FIELD_CHANGES; CS renewals recompute | M15 AC3, M11 AC11 |
| Handoff summary | `PUT /api/entities/{id}/handoff-summary` | `{ slaAvailabilityPct, slaMaxResponseMs, slaOther, specialTerms, entitiesNotInPortal, notesForOnboarding, version }` | Sales | Audit, History OTHER_FIELD_CHANGES; Sales → Ops snapshot unchanged | M3 AC14, resolution 32 |
| Commercial terms | `PUT /api/entities/{id}/commercial-terms` | `{ currency, pricePerVerification, volumeTiers[], monthlyMinimum, paymentTermDays, version }` | Sales, Finance | Tiers replaced. Audit, History "Commercial terms changed" (OTHER_FIELD_CHANGES) | M3 AC5, AC14, AC17, edge 6, D3 |
| Partner agreement | `PUT /api/entities/{id}/partner-agreement` | `{ contractId, title, signingDate, documentUrl }` | Ops | `Contract` with `kind = PARTNER_AGREEMENT`. Audit, History NETWORK_AND_STRUCTURE | M4 AC11, resolution 51 |
| Connection method | `PUT /api/entities/{id}/connection` | `{ connectionMethod, providerName?, version }` | Network | Provider cleared when not routing provider. Audit, History "Connection method: Direct → Via routing provider (ClearRoute Services)" | M5 AC2, AC14, AC15 |
| Add coverage | `POST /api/entities/{id}/coverage` | `{ country, scheme, status, effectiveDate, reason }` | Network | Coverage row + first `CoverageStatusChange`; lifecycle recomputed for partner-only entities (B1). Audit (Coverage row). History NETWORK_AND_STRUCTURE | M5 AC3-AC6, AC14, AC17 |
| Change coverage status | `POST /api/coverage/{id}/status` | `{ status, effectiveDate, reason, version }` | Network | New `CoverageStatusChange`; lifecycle recomputed for partner-only entities (B1). Audit, History "Coverage GB / UK CoP: Active → Degraded (effective 28 Sep 2026). Reason: ... By Lukas Brenner, Network." Overview alert and header warning recompute | M5 AC7-AC9, AC12, AC14, AC15, AC17 |
| Add product line | `POST /api/entities/{id}/products` | `{ product, country, contractingEntityId, targetGoLive }` | Ops | Line at Contract signed, entry today; lifecycle recomputed. Audit, History "Product line added" | M6 AC18, M3 AC17, resolution 44 |
| Edit product line | `PATCH /api/products/{id}` | `{ product, country, contractingEntityId, reason, version }` | Sales, Ops | Audit with reason, History STAGE_CHANGE | M3 AC14 |
| Change target go-live | `POST /api/products/{id}/target-date` | `{ targetGoLive, reason, version }` | Sales, Ops | `StageEvent TARGET_DATE_CHANGED`. Audit, History | M6 AC10, AC15, AC16 |
| Change stage | `POST /api/products/{id}/stage` | `{ toStage, entryDate, note?, reason?, resolveBlock, version }` | Ops | Stage, entry date, skipped stages, `billableFrom`, optional block resolve; lifecycle recomputed. `StageEvent`. Audit per field, History "EU VoP / DE: UAT → Go-live approval (entered 01 Oct 2026). By Adrian Koh, Ops" or "Stage moved back", "Billable from date removed" | M6 AC4-AC6, AC9, AC11, AC12, AC16, AC17 |
| Set or edit block | `PUT /api/products/{id}/block` | `{ blockedBy, reason, version }` | Ops | Open block fields (`blockedSince` today on set). `StageEvent`, audit, History "UK CoP / GB marked blocked by Partner: ..." | M6 AC7, AC8 |
| Resolve block | `POST /api/products/{id}/block/resolve` | `{ note?, version }` | Ops | Clears block, `StageEvent BLOCK_RESOLVED` with days. Audit, History "UK CoP / GB block resolved after 6 days" | M6 AC8 |
| Cancel product line | `POST /api/products/{id}/cancel` | `{ reason, version }` | Ops | `cancelledAt`, `cancelReason`; lifecycle recomputed; leaves worklists. Audit, History | M6 AC19, resolution 44 |
| Add contact | `POST /api/entities/{id}/contacts` | `{ context, role, fullName, email, phone, timeZone, availability, jobTitle, isPrimary?, confirmDuplicate? }` | Owner team of (context, role) | `ownerTeams` set, `lastVerifiedAt` today by the creator. Audit, History CONTACT_CHANGE | M7 AC1-AC4, AC12, AC14, AC15 |
| Edit contact | `PATCH /api/contacts/{id}` | Same fields + `status` (Left → Active) + `version` | Owner teams | Role or context change recomputes `ownerTeams`. Audit, History for role, email, phone, availability, status | M7 AC3, AC14, AC15, edge 6 |
| Mark as verified | `POST /api/contacts/{id}/verify` | `{ version }` | Owner teams | `lastVerifiedAt` today, `lastVerifiedById`. Audit only | M7 AC5, AC15 |
| Mark as left | `POST /api/contacts/{id}/left` | `{ leftOn, note?, confirmLastIncident?, version }` | Owner teams | Status LEFT; last active Incident returns 409 `needsConfirmation` "Lloyds Bank plc will have no active incident contact" first. Audit, History CONTACT_CHANGE | M7 AC6-AC8 |
| Set primary incident | `POST /api/contacts/{id}/primary` | `{ version }` | Owner teams (Incident role) | Clears the previous primary in the same transaction. Audit, History "Incident contact changed: Primary is now ..." | M7 AC9, AC15 |
| Reassign owner | `POST /api/entities/{id}/owner` | `{ newOwnerId, reason, expectedOwnerId }` | CS | `ownerId`, `ownerSince`; `OwnerAssignment` unless self-assignment; supersedes an unacknowledged one; `expectedOwnerId` mismatch returns 409 "Owner was changed by <name> at <time>. Reload to see the current owner." Audit (owner, with reason), History OWNER_REASSIGNED | M9 AC3-AC11, edge 1, edge 3, edge 4 |
| Acknowledge assignment | `POST /api/owner-assignments/{id}/acknowledge` | `{}` | The assignee | `acknowledgedAt`. Audit (Owner assignment). Badge count drops | M9 AC10 |
| Add note | `POST /api/entities/{id}/notes` | `{ type, interactionDate, participants[], summary, actionItems[] }` | All teams | Note with `authorTeam`. Audit (Note, Action item) | M10 AC1-AC4, M16 AC1 |
| Edit note | `PATCH /api/notes/{id}` | Same fields | Author within 24 hours | `editedAt`. Audit old and new | M10 AC11, edge 1 |
| Toggle action item | `POST /api/action-items/{id}/toggle` | `{}` | Note author or item owner | OPEN ↔ DONE, `statusChangedById`, `statusChangedAt`. Audit | M10 AC10 |
| Save KYB check | `PUT /api/entities/{id}/kyb/{type}` | Type fields + `verifiedOn`, `evidenceUrl`, `version` | Compliance | `verifiedById` = current user. Audit per field, History OTHER_FIELD_CHANGES | M12 AC2-AC10, AC13, AC14 |
| Save periodic review | `PUT /api/entities/{id}/review` | `{ status, lastReviewDate?, nextReviewDate, version }` | Compliance | `pastDue` rule. Audit, History | M12 AC11-AC14 |
| Complete review | `POST /api/entities/{id}/review/complete` | `{ completionDate, nextReviewDate, version }` | Compliance | Status PLANNED with new date. Audit, History | M12 AC12 |
| Save obligations | `PUT /api/entities/{id}/obligations/{kind}` | The 8 card fields + `version` | Compliance | `updatedById`. Audit per changed field, History OTHER_FIELD_CHANGES | M13 AC2-AC6, AC14 |
| Save billing profile | `PUT /api/entities/{id}/billing-profile` | The profile fields + `version` (create when absent) | Finance | Audit per changed field, History OTHER_FIELD_CHANGES; flag and badge recompute | M14 AC1-AC5, AC10, AC12, AC14 |
| Add user | `POST /api/admin/users` | `{ name, email, team }` | Admin | `User`, `UserTeamChange USER_ADDED`, audit (User) | M15 AC6, AC14 |
| Change team | `PATCH /api/admin/users/{id}/team` | `{ team }` | Admin, not on self | `User.team`, `UserTeamChange TEAM_CHANGED`, audit "User · Team · Sales · Finance"; next request uses the new team | M15 AC5, AC14, edge 1 |

No endpoint updates or deletes an `AuditEntry`, deletes an entity, deletes a contact, deletes a coverage row or deletes a product line (M16 AC3, AC14, M7 AC6, M5 AC10, M6 AC19).

#### 3.8.3 Issue flow reads and writes (milestones 6A to 6C, 12A)

Issue routes take the display ID (`ISS-1042`). "Owner", "communicator" and "reporter" mean the role on that issue at request time, computed by `issueRoles()` (4.9.12); `can()` checks the matrix rows 31 to 34 (4.1.2) and then the role predicate. Every write runs in one transaction with its audit entries (object "Issue: ISS-<n>") and its `INCIDENT` History event (4.9.11), carries the issue `version`, and returns 409 on a stale version. A write on an issue of a soft-deleted entity returns the deleted-entity response of 4.1.5. 403 bodies use the codes of 4.9.12.

**Reads**

| Method and path | Who | Returns | AC |
|---|---|---|---|
| `GET /api/issues/{issueId}` | All teams | Issue page model: fields, roles, effective communicator, clock rows with state and text, people, notes, log, assessments, resolution, links, customer obligations block, `serverNow`. Runs the idempotent system writes of 4.9.7 first | M18 AC9, M19 AC12, M21, M22, M25, M26 AC8 |
| `GET /api/entities/{id}/issues?status=open|all` | All teams | Issues of the entity, newest first | M17 screens, empty state |
| `GET /api/entities/{id}/issue-context` | All teams | Report form context: product lines with stages, active contacts, partner coverage rows, issue team, customer agreement values for the proposal | M17 AC2, AC7 to AC9 |
| `GET /api/entities/{id}/issues/similar?scheme&country` | All teams | Open issues on the entity with the same scheme and country (both empty matches both empty) | M17 AC5, edge case 4 |
| `GET /api/issues/{issueId}/message` | All teams (actions for the communicator only) | Template subject, body, recipient and Gmail URL in the incident contact's time zone | M22 AC3 to AC5 |
| `GET /api/issues/{issueId}/affected-customers` | All teams | Affected customers and "Not affected: before go-live" groups for a partner issue | M23 AC5, AC6, AC13 |
| `GET /api/worklist/issues?scope=mine|team` | All teams ("team" for Ops and CS) | Main list, Contributing, Reported by me, section count, badge contribution, `serverNow`. Runs the system writes of 4.9.7 for the rows it returns | M20 AC1 to AC13 |
| `GET /api/users?team=&active=true` | All teams | Pickers for contributors (all teams) and reassignment (owner team) | M21 AC6, AC8 |

**Writes**

| Action | Method and path | Input | Who | Side effects | AC |
|---|---|---|---|---|---|
| Report issue | `POST /api/entities/{id}/issues` | Report fields (3.4.3) | Any active user of the 6 teams | Severity computed, routing run, clocks started, default contributor, Compliance flag, `Issue` created with the next number. Audit: one entry per field set and one for routing. History "Issue ISS-1043 reported by ..." and "ISS-1043 routed to ..." | M17 AC1 to AC3, AC7 to AC10, AC12, AC13, M18 AC1 to AC8, AC11, M19 AC1 to AC5, M25 AC2 |
| Report on a group | `POST /api/groups/{id}/issues` | Report fields + `entityIds[]` | Any active user | `IssueGroupReport` + one issue per entity, each routed on its own, all in one transaction | M17 AC4 |
| Add to existing issue | `POST /api/issues/{issueId}/reports` | Report fields | Any active user | `IssueNote` kind ADDED_REPORT with "Reported impact suggests Sev-1" when higher; owner and severity unchanged. Audit on the target. History "Report added to ISS-1038 by ..." | M17 AC6, edge case 8 |
| Edit description | `PATCH /api/issues/{issueId}/description` | `{ description, version }` | Reporter while New | Audit old and new | M17 AC11, AC12 |
| Acknowledge | `POST /api/issues/{issueId}/acknowledge` | `{ version }` | Owner, status New | In progress, `acknowledgedAt`; CREATED linked issues in New move to In progress. Audit, History | M21 AC1, M23 AC7 |
| Change status | `POST /api/issues/{issueId}/status` | `{ status, note?, reason?, version }` | Owner, acknowledged | Status; from Resolved back to In progress needs a reason and supersedes the resolution. Audit, History | M21 AC2, AC3, AC5 |
| Resolve | `POST /api/issues/{issueId}/resolve` | `{ rootCause, solution, version }` | Owner | Resolved, `IssueResolution`; on a partner issue the cascade of 4.9.8. Audit, History per issue | M21 AC4, M23 AC11 |
| Change severity | `POST /api/issues/{issueId}/severity` | `{ severity, reason, version }` | Owner | Recalculation of 4.9.6; Compliance flag re-evaluated. Audit with reason, History | M19 AC13 to AC15, AC19, AC20, M25 AC2 |
| Change type | `POST /api/issues/{issueId}/type` | `{ type, reason, version }` | Owner | Owner team, routing rules 2 to 4 again, status New, acknowledge clock restarts, default contributor added, flag re-evaluated; CREATED children follow the new owner | M19 AC17 to AC20, M23 AC17 |
| Add contributor | `POST /api/issues/{issueId}/contributors` | `{ userId, version }` | Owner | `IssueContributor`. Audit, History | M21 AC6 |
| Remove contributor | `POST /api/issues/{issueId}/contributors/{userId}/remove` | `{ version }` | Owner | `removedAt`. Audit, History | M21 AC6 |
| Reassign | `POST /api/issues/{issueId}/reassign` | `{ newOwnerId, reason, version }` | Owner; refused on CREATED linked issues | Owner, `ownerSince`; clocks keep start and due; communicator moves with the owner when the owner communicates; CREATED children follow. Audit, History | M21 AC8 to AC10, M23 AC17 |
| Add note | `POST /api/issues/{issueId}/notes` | `{ body }` | All teams | `IssueNote`. Audit, History "Note added to ISS-1042 by ..." | M21 AC7, AC12 |
| Record communication | `POST /api/issues/{issueId}/communications` | `{ type, occurredAt, channel, contactId?, personName?, message, version }` | Communicator | `IssueCommunication`; a first notification sets `notifiedAt`; R2 facts and breach types stop their clocks. Audit, History "ISS-1042: First notification to Silvia Moretti by Email, recorded by Kevin Lim" | M22 AC6, AC7, AC13, AC19 |
| Close | `POST /api/issues/{issueId}/close` | `{ personContactId?, personName?, channel, occurredAt, note?, version }` | Communicator, status Resolved | Closed, `closedAt`; log entry "Closure confirmed". Audit, History | M22 AC11, AC12 |
| Set coverage to Degraded | existing `POST /api/coverage/{id}/status` | prefilled by the proposal banner | Network (M5) | As M5, plus the banner line on the partner issue | M23 AC4 |
| Create or attach linked issues | `POST /api/issues/{issueId}/linked-issues` | `{ rows: [{ entityId, productId, action: "create" } \| { action: "attach", issueId }] }` | Owner of the partner issue | All rows in one transaction or none (4.9.8). Audit and History on both entities | M23 AC7 to AC9, AC16 |
| Unlink | `POST /api/issues/{issueId}/links/{linkId}/unlink` | `{ reason }` | Owner of the partner issue | `unlinkedAt`; child keeps its current owner. Audit, History on both entities | M23 AC14 |
| Record assessment | `POST /api/issues/{issueId}/compliance-assessments` | `{ outcome, rationale }` | Any Compliance user | `ComplianceAssessment`; "Neither" sets `complianceClosedAt`; R2 starts the facts or breach clock. Audit, History | M25 AC6 to AC11 |
| Save obligations (extended) | existing `PUT /api/entities/{id}/obligations/CUSTOMER_AGREEMENT` | The 8 card fields + the regulatory fields + `version` | Compliance | As M13; regime None clears facts hours and report days | M26 AC2 to AC6 |
| Reopen (R2) | `POST /api/issues/{issueId}/reopen` | `{ reason, version }` | Communicator, within 10 business days of "Closed at" | In progress, acknowledge clock restarts | M22 AC15 |
| Take over communication (R2) | `POST /api/issues/{issueId}/take-over` | `{ reason, version }` | Customer Success user, communicator absent, customer issue | `TAKEN_OVER`, log entry | M22 AC17 |
| Record report sent (R2) | `POST /api/issues/{issueId}/root-cause-report` | `{ sentAt, contactId, channel, reportUrl?, summary }` | Owner | Task sent; log entry | M27 AC5, AC7 |

"Copy message", "Open in Gmail" and "Copy for the customer" run in the browser and write nothing (M22 AC19). No endpoint edits or deletes an issue note, a log entry, an assessment or an issue.

### Conflicts resolved

- M4 AC9 asks only for an `https://` document link; the Shared conventions require https and an approved host for every evidence and contract link. The conventions win: contract, partner agreement and obligation links all use `checkDocLink`.
- M15 AC14 says the Change history panel reads the User audit entries; the brief asks for a `UserTeamChange` model. Both are written in the same transaction with the same values, and the panel reads `UserTeamChange`.
- M11 AC3 scopes Sales items to "entities the user created", while M2 AC13 lets Sales add a Customer role to an existing partner. Sales scope uses `CustomerRole.createdById`, which covers both paths.
- The earlier solution design listed only Sent and Confirmed for handoffs; the ACs win with Sent, Confirmed, Accepted, Declined, Cancelled.
- The ACs define Overdue as a review status "set automatically" (M12 AC12) and coverage status as stored per row (M5); both are derived at read time from stored dates (3.2.4), which gives the same behaviour with no scheduled job.
- The brief allows server actions or route handlers; route handlers are used for every write so direct calls return a real HTTP 403 (M15 AC9, M16 AC4).


---

## 4. Business rules

This section defines the server-side rules. Every rule here runs in the service layer (`src/server/services/*`) and is enforced on the server. The UI reads the same functions to decide which controls to render, and never acts as the only check.

Shared conventions used throughout:

| Convention | Rule |
|---|---|
| Today | `today()` returns the current calendar date in `Europe/Bucharest` as a date-only value (`YYYY-MM-DD`). Never use the server's local date or UTC date for business comparisons. |
| Date-only fields | Stage entry dates, target go-live, renewal date, expiry dates, review dates, blocked since, leave date, due dates: Postgres `DATE` (`@db.Date`). Compared date-only. |
| Timestamps | Audit timestamps, sent/confirmed/accepted times, note created time: `timestamptz`, stored UTC, displayed in the viewer's local time with the UTC offset, for example "02 Oct 2026 10:05 (UTC+03:00)". |
| Display date format | `02 Oct 2026`. |
| Days between dates | `daysBetween(a, b)` = calendar days from date `a` to date `b` (b minus a). Used for "days in stage", "days blocked", "days late", "in n days". |
| Business days | Monday to Friday, no holiday calendar (resolution 14). |
| Reason lengths | Stage skip/back, block, cancel line, target go-live change: 5 to 500 characters. Decline, cancel handoff, reassign owner, soft delete, reactivation with LEI conflict, mark inactive: 10 to 500 characters. |
| Concurrency | Every editable aggregate (entity, product line, contact, coverage row, customer role, billing profile, KYB check, review) carries `version Int`. A write sends the version it read; a mismatch returns 409 with the story's "Reload" copy and writes nothing. |
| Schema of record | The Prisma schema in 3.2.2 is the only schema. The model sketches in this section (4.2.2, 4.2.4, 4.3.2, 4.4.1, 4.5) describe the rules; build them on the 3.2.2 models with this mapping: `ProductLine` = `ContractedProduct` (`customerEntityId` = `entityId`, `scheme` = `product`, `currentStage` = `stage`, `stageEnteredOn` = `stageEnteredAt`, `status = CANCELLED` / `cancelledOn` = `cancelledAt` not null); `StageTransition` = `StageEvent` (`productLineId` = `productId`, `enteredOn` = `entryDate`, kinds `INITIAL` / `FORWARD` / `SKIP` / `BACK` = `PRODUCT_ADDED` / `STAGE_FORWARD` / `STAGE_SKIP` / `STAGE_BACKWARD`); `ProductBlock` = the open-block fields on `ContractedProduct` plus `StageEvent` rows `BLOCK_SET` / `BLOCK_EDITED` / `BLOCK_RESOLVED` (`resolvedOn` = the `BLOCK_RESOLVED` event date); `BlockParty` = `BlockedBy`; `AuditEntry.changeSetId` and `HistoryEvent.changeSetId` = `actionId`; `HistoryEvent.text` = `summary`, `inline` = `details`; `Handoff.sentOn` = the Europe/Bucharest date of `sentAt`, `closedAt` = `confirmedAt`, `acceptedAt`, `declinedAt` or `cancelledAt`, `closeReason` = `declineReason` or `cancelReason`; `OwnerAssignment.toOwnerId` = `assigneeId`, `fromOwnerId` = `previousOwnerId`; `Contact.lastVerifiedOn` = `lastVerifiedAt`; `Contact.ownership` = `ownerTeams` (`SALES_CS` = `[SALES, CS]`, `OPS` = `[OPS]`, `NETWORK` = `[NETWORK]`, `FINANCE` = `[FINANCE]`); `LegalEntity` = `Entity`. |

### 4.1 Permissions

#### 4.1.1 The six teams and the admin flag

- Teams are fixed in code: `Sales`, `Ops`, `CS`, `Network`, `Compliance`, `Finance` (M15 AC1). Display names: "Sales", "Ops" (also "Ops / Onboarding" in filters), "Customer Success", "Network", "Compliance", "Finance".
- Every user has exactly one team. `User.isAdmin` is a separate boolean. The seed sets it on Adrian Koh (Ops) only. The UI shows it read-only and cannot change it (M15 AC2).
- The admin flag grants exactly: Admin > Users & roles, Admin > Deleted records, Admin > Roles & permissions, the entity Audit tab, soft delete and reactivation, and "Reset demo data" when `DEMO_MODE=true` (M15 AC2, AC3, resolution 4). It grants no edit rights in any data area. The admin edits data with Ops rights only: the Compliance, Billing and Partner tabs are read-only for the admin, and the admin cannot reassign owners (M9 AC3).
- The user's team and admin flag are read from the database on every request. They are never cached in the session cookie, so a team change applies on the user's next request (M15 AC5, AC10).

#### 4.1.2 Ownership matrix (single source of truth)

M15 AC3 as updated by decisions P2, P4, D1, D3 and resolutions 33, 36, 38, 47, 48, 52. E = edit, R = read, add = can add (History notes), hidden = not rendered and API 403, none = no access. The "Where" column names the screen where the edit happens. The "Label" column is the read-only label shown to teams without E.

| # | Data area | Where | Sales | Ops | CS | Network | Compliance | Finance | Label for read-only viewers |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Create customer (wizard, incl. "Add Customer role to this existing entity") | S3 | E | none | none | none | none | none | "Only Sales can create a customer record" (page) |
| 2 | Entity core: legal name, aliases, type, country, LEI, BICs | Details > Entity core | E at creation (wizard), then R | E | R | R | R | R | Owned by Ops |
| 3 | Group link, group create/edit, link, unlink, move | Details > Entity core, S5 | R | E | R | R | R | R | Owned by Ops |
| 4 | Roles (Customer, Network partner) | Details > Roles | R (set at creation by the wizard) | E | R | R | R | R | Owned by Ops |
| 5 | Lifecycle state: set Inactive / Mark as active. Onboarding, Live, BAU are computed (4.3.6) | Details > Lifecycle state | R | E | R | R | R | R | Owned by Ops |
| 6 | Customer role: contract reference (applicable contract, invoiced entity) | Details > Customer role | R | E | R | R | R | R | Owned by Ops |
| 7 | Customer role: renewal date | Details > Customer role | R | R | E | R | R | R | Owned by Customer Success |
| 8 | Customer role: handoff summary (promised SLAs, special terms, contracted entities not yet in the portal, notes for Onboarding) | Details > Customer role | E (stays editable in MVP) | R | R | R | R | R | Owned by Sales |
| 9 | Customer role: commercial terms (currency, price per verification, tiers, monthly minimum, payment term) | Details > Customer role | E | R | R | R | R | E | Owned by Sales and Finance |
| 10 | Partner role: partner agreement reference | Details > Partner role | R | E | R | R | R | R | Owned by Ops |
| 11 | Partner role: connection method, provider, coverage rows and status | Partner tab | R | R | R | E | R | R | Owned by Network |
| 12 | Contracted products: add line | Products & onboarding | R | E | R | R | R | R | Owned by Ops |
| 13 | Contracted products: edit product, country, contracting entity, target go-live (reason on every change) | Products & onboarding | E | E | R | R | R | R | Owned by Ops (stage controls) |
| 14 | Onboarding stages, stage dates, blocks, cancel product line | Products & onboarding | R | E | R | R | R | R | Owned by Ops |
| 15 | Contacts, Customer context: Champion, Decision maker | Contacts | E | R | E | R | R | R | Owned by Sales and Customer Success (always, resolution 47) |
| 16 | Contacts, Customer context: Technical, Incident, Escalation | Contacts | R | E | R | R | R | R | Owned by Ops |
| 17 | Contacts, Partner context: every role except Billing | Contacts | R | R | R | E | R | R | Owned by Network |
| 18 | Contacts: Billing (either context) | Contacts | R | R | R | R | R | E | Owned by Finance |
| 19 | KYB checks, GLEIF refresh, periodic review | Compliance tab | R | R | R | R | E | R | Owned by Compliance |
| 20 | Contractual obligations (Customer and Partner agreement cards) | Compliance tab | R | R | R | R | E | R | Owned by Compliance |
| 21 | Billing profile | Billing tab | R | R | R | R | R | E | Owned by Finance |
| 22 | History notes | History | add | add | add | add | add | add | n/a |
| 23 | Current owner: reassign / set owner (M9) | Header | R | R | E | R | R | R | Tooltip "Owned by Customer Success" on the lock icon (resolution 43) |
| 24 | Handoff Sales → Ops | S6, header banner | E: send (wizard), change recipient while Sent | E: confirm pickup (named recipient only) | R | R | R | R | n/a |
| 25 | Handoff Ops → CS | S6, header | R | E: send, cancel (any Ops user) | E: accept, decline (chosen CSM only, while in CS) | R | R | R | n/a |
| 26 | Audit tab | Entity record | hidden | hidden (visible to the admin) | hidden | hidden | R | hidden | n/a |
| 27 | Roles & permissions page | Admin | hidden | hidden (visible to the admin) | hidden | hidden | R | hidden | n/a |
| 28 | Users & roles (incl. Change history), Deleted records | Admin | none | admin only | none | none | none | none | n/a |
| 29 | Soft delete, reactivation | Header menu, Admin | none | admin only | none | none | none | none | n/a |
| 30 | Reset demo data (`DEMO_MODE` only) | Admin | none | admin only | none | none | none | none | n/a |
| 31 | Issues: report (entity or group), "Add to existing issue", issue notes (M17, M21 AC7) | Entity record, group record, Issue page | E | E | E | E | E | E | n/a |
| 32 | Issue owner actions: acknowledge, status, resolve, severity, type, contributors, reassign, linked issues, root cause report (R2) | Issue page | E (issue owner only) | E (issue owner only) | E (issue owner only) | E (issue owner only) | E (issue owner only) | E (issue owner only) | "Only the owner, <name>, can change this issue" |
| 33 | Issue communicator actions: record notification and update, close, reopen (R2), take over (R2, Customer Success) | Issue page | E (current communicator only) | E (current communicator only) | E (current communicator only) | E (current communicator only) | E (current communicator only) | E (current communicator only) | n/a |
| 34 | Compliance assessment on an issue (M25) | Issue page | R | R | R | R | E | R | Owned by Compliance |

Rows 31 to 34 come with the issue flow (milestone 6A). They render on Roles & permissions under a new group "Issues" (`AreaPolicy.group` gains `'Issues'`), with the areas `issue.report`, `issue.owner`, `issue.communicator` and `issue.compliance`. Rows 32 and 33 are team-level E for every team; the person check is the `check` predicate of 4.9.12. The regulatory block of M26 belongs to row 20.

Every team can open and read every non-deleted entity, every tab except Audit, every group record and every handoff (M1 AC16). Tab visibility rules that depend on the record's data: the Partner tab shows only with the Network partner role; Products & onboarding is hidden for partner-only entities (resolution 46).

Contact ownership (M15 AC4, M7 AC3, resolution 48):
- `Contact.ownership` is stored and set from `(context, role)` when the contact is created and whenever its role or context changes:

  | Context | Role | `ownership` |
  |---|---|---|
  | Customer | Champion, Decision maker | `SALES_CS` |
  | Customer | Technical, Incident, Escalation | `OPS` |
  | Partner | Champion, Decision maker, Technical, Incident, Escalation | `NETWORK` |
  | Customer or Partner | Billing | `FINANCE` |

- Edit rights follow the stored `ownership`, never the creating user. Moving a user to another team does not move their contacts (M15 edge case 3). Removing the Partner role keeps Network ownership on Partner-context contacts (M15 edge case 4).
- The Add contact role dropdown lists only the roles the user's team owns in the chosen context.

#### 4.1.3 Implementation: one policy table and one `can()` function

The matrix above exists once in code. `can()` reads it for every server check, the UI reads it to render controls and labels, and S7.3 Roles & permissions renders it (M15 AC13). A unit test asserts that every write route calls `can()` (route registry test) and a snapshot test pins the matrix.

```ts
// src/server/permissions/matrix.ts
export const TEAMS = ['Sales', 'Ops', 'CS', 'Network', 'Compliance', 'Finance'] as const;
export type Team = (typeof TEAMS)[number];   // matrix keys; the Prisma enum Team (SALES, OPS, CS, NETWORK, COMPLIANCE, FINANCE) maps 1:1
export const TEAM_FROM_DB: Record<import('@prisma/client').Team, Team> = {
  SALES: 'Sales', OPS: 'Ops', CS: 'CS', NETWORK: 'Network', COMPLIANCE: 'Compliance', FINANCE: 'Finance',
};

export const TEAM_DISPLAY: Record<Team, string> = {
  Sales: 'Sales', Ops: 'Ops', CS: 'Customer Success',
  Network: 'Network', Compliance: 'Compliance', Finance: 'Finance',
};

/** E = edit, R = read, add = add-only, hidden = not rendered + 403, none = no access, admin = isAdmin users of that team only */
export type Cell = 'E' | 'R' | 'add' | 'hidden' | 'none' | 'admin';

export type DataArea =
  | 'customer.create' | 'entity.core' | 'entity.group' | 'entity.roles' | 'entity.lifecycle'
  | 'customer.contract' | 'customer.renewal' | 'customer.handoffSummary' | 'customer.commercialTerms'
  | 'partner.agreement' | 'partner.coverage'
  | 'product.add' | 'product.edit' | 'product.stage'
  | 'contact.SALES_CS' | 'contact.OPS' | 'contact.NETWORK' | 'contact.FINANCE'
  | 'compliance.kyb' | 'compliance.obligations' | 'billing.profile'
  | 'history.note' | 'owner.reassign'
  | 'handoff.salesOps' | 'handoff.opsCs'
  | 'audit.read' | 'admin.permissions' | 'admin.users' | 'admin.deleted' | 'admin.softDelete' | 'admin.demoReset';

export interface AreaPolicy {
  area: DataArea;
  group: 'Entity' | 'Products and onboarding' | 'Contacts' | 'Partner' | 'Compliance' | 'Billing' | 'Collaboration' | 'Admin';
  rowLabel: string;                               // row text on Roles & permissions
  cells: Record<Team, Cell>;
  cellNotes?: Partial<Record<Team, string>>;      // e.g. { Sales: 'E at creation (wizard)' }
  ownerLabel?: string;                            // e.g. 'Owned by Sales and Finance'
}

const R6 = { Sales: 'R', Ops: 'R', CS: 'R', Network: 'R', Compliance: 'R', Finance: 'R' } as const;

export const PERMISSION_MATRIX: readonly AreaPolicy[] = [
  { area: 'customer.create', group: 'Entity', rowLabel: 'Create customer (wizard)',
    cells: { Sales: 'E', Ops: 'none', CS: 'none', Network: 'none', Compliance: 'none', Finance: 'none' } },
  { area: 'entity.core', group: 'Entity', rowLabel: 'Entity core (legal name, aliases, type, country, LEI, BICs)',
    cells: { ...R6, Ops: 'E' }, cellNotes: { Sales: 'E at creation (wizard)' }, ownerLabel: 'Owned by Ops' },
  { area: 'customer.commercialTerms', group: 'Entity', rowLabel: 'Commercial terms',
    cells: { ...R6, Sales: 'E', Finance: 'E' }, ownerLabel: 'Owned by Sales and Finance' },
  { area: 'contact.SALES_CS', group: 'Contacts', rowLabel: 'Contacts: Champion, Decision maker (Customer context)',
    cells: { ...R6, Sales: 'E', CS: 'E' }, ownerLabel: 'Owned by Sales and Customer Success' },
  { area: 'handoff.opsCs', group: 'Collaboration', rowLabel: 'Handoff Ops → CS',
    cells: { ...R6, Ops: 'E', CS: 'E' }, cellNotes: { Ops: 'E (send, cancel)', CS: 'E (accept, decline)' } },
  { area: 'audit.read', group: 'Admin', rowLabel: 'Audit log',
    cells: { Sales: 'hidden', Ops: 'hidden', CS: 'hidden', Network: 'hidden', Compliance: 'R', Finance: 'hidden' },
    cellNotes: { Ops: 'hidden (visible to the admin)' } },
  { area: 'admin.demoReset', group: 'Admin', rowLabel: 'Reset demo data (DEMO_MODE only)',
    cells: { Sales: 'none', Ops: 'admin', CS: 'none', Network: 'none', Compliance: 'none', Finance: 'none' } },
  // ... one entry per row of the 4.1.2 table, same values
];
```

```ts
// src/server/permissions/can.ts
export interface SessionUser { id: string; name: string; team: Team; isAdmin: boolean; active: boolean }

export type Action =
  // reads
  | 'entity.read' | 'audit.read' | 'admin.permissions.read' | 'admin.users.read' | 'admin.deleted.read'
  // entity record writes
  | 'customer.create' | 'entity.core.update' | 'entity.group.update' | 'entity.roles.update'
  | 'entity.lifecycle.update' | 'entity.gleif.retry'
  | 'customer.contract.update' | 'customer.renewal.update' | 'customer.handoffSummary.update'
  | 'customer.commercialTerms.update' | 'partner.agreement.update' | 'partner.coverage.update'
  | 'product.add' | 'product.edit' | 'product.targetGoLive.update' | 'product.stage.change'
  | 'product.block.update' | 'product.cancel'
  | 'contact.create' | 'contact.update' | 'contact.verify' | 'contact.markLeft' | 'contact.setPrimary'
  | 'compliance.kyb.update' | 'compliance.gleif.refresh' | 'compliance.review.update' | 'compliance.obligations.update'
  | 'billing.profile.update'
  | 'note.create' | 'note.update' | 'actionItem.toggle'
  | 'owner.reassign' | 'owner.acknowledge'
  | 'handoff.salesOps.changeRecipient' | 'handoff.salesOps.confirm'
  | 'handoff.opsCs.send' | 'handoff.opsCs.cancel' | 'handoff.opsCs.accept' | 'handoff.opsCs.decline'
  // admin
  | 'admin.users.update' | 'entity.softDelete' | 'entity.reactivate' | 'admin.demoReset';

export interface Resource {
  entity?: { id: string; deletedAt: Date | null };
  contact?: { ownership: 'SALES_CS' | 'OPS' | 'NETWORK' | 'FINANCE' };
  newContact?: { context: 'Customer' | 'Partner'; role: ContactRole };     // contact.create, role/context change
  handoff?: { type: 'SALES_TO_OPS' | 'OPS_TO_CS'; status: HandoffStatus; toUserId: string };
  note?: { authorId: string; createdAt: Date };
  actionItem?: { ownerId: string; noteAuthorId: string };
  assignment?: { toOwnerId: string };
  targetUserId?: string;                                                   // admin.users.update
}

export type Decision =
  | { ok: true }
  | { ok: false; status: 403; code: 'forbidden'; ownerTeam?: string }      // team not allowed
  | { ok: false; status: 403; code: 'not_recipient' | 'not_author' }       // right team, wrong person
  | { ok: false; status: 409; code: 'entity_deleted' | 'edit_window_closed' | 'invalid_state' }
  | { ok: false; status: 404; code: 'not_found' };                          // demo reset when DEMO_MODE is off

/** Maps each action to its matrix area plus an optional per-resource predicate. */
const ACTION_POLICY: Record<Action, { area: DataArea | ((r: Resource) => DataArea); need: 'E' | 'R' | 'add'; check?: (u: SessionUser, r: Resource) => Decision }> = {
  'contact.update':           { area: r => `contact.${r.contact!.ownership}`, need: 'E' },
  'contact.create':           { area: r => `contact.${ownershipFor(r.newContact!)}`, need: 'E' },
  'handoff.salesOps.confirm': { area: 'handoff.salesOps', need: 'E',
                                check: (u, r) => r.handoff!.toUserId === u.id ? OK : deny('not_recipient') },
  'handoff.opsCs.accept':     { area: 'handoff.opsCs', need: 'E',
                                check: (u, r) => u.team === 'CS' && r.handoff!.toUserId === u.id ? OK : deny('not_recipient') },
  'note.update':              { area: 'history.note', need: 'add',
                                check: (u, r) => r.note!.authorId !== u.id ? deny('not_author')
                                  : Date.now() - r.note!.createdAt.getTime() > 24 * 3600_000 ? conflict('edit_window_closed') : OK },
  'actionItem.toggle':        { area: 'history.note', need: 'add',
                                check: (u, r) => [r.actionItem!.ownerId, r.actionItem!.noteAuthorId].includes(u.id) ? OK : deny('not_author') },
  // ... every Action listed
};

export function can(user: SessionUser, action: Action, resource: Resource = {}): Decision {
  // 1. Soft-deleted entity: only the admin can read it, only reactivation writes to it (M16 AC11).
  if (resource.entity?.deletedAt) {
    if (action === 'entity.read' || action === 'audit.read') return user.isAdmin ? OK : forbidden();
    if (action !== 'entity.reactivate') return conflict('entity_deleted');
  }
  // 2. Team cell from the matrix.
  const p = ACTION_POLICY[action];
  const area = typeof p.area === 'function' ? p.area(resource) : p.area;
  const cell = MATRIX_BY_AREA[area].cells[user.team];
  const teamOk =
    cell === p.need || (cell === 'E' && p.need !== 'add') ||          // E implies R
    (cell === 'admin' && user.isAdmin) ||
    (cell === 'hidden' && user.isAdmin && ADMIN_VISIBLE.has(area));    // audit.read, admin.permissions
  if (!teamOk) return { ok: false, status: 403, code: 'forbidden', ownerTeam: MATRIX_BY_AREA[area].ownerLabel?.replace('Owned by ', '') };
  // 3. Per-resource predicate (named recipient, author, 24h window).
  return p.check ? p.check(user, resource) : OK;
}
```

Usage rules:
- Every route handler calls `can()` first (through `assertCan()` in `src/server/permissions/guard.ts`, 3.1.1, which throws `ForbiddenError` on `ok: false`; `can()` may live in `guard.ts` or a sibling `can.ts`), then again inside the transaction after re-reading the resource (so a status or ownership that changed between read and write is caught). On `ok: false` it returns the HTTP status and writes nothing, including no audit entry (M15 AC9).
- React server components call `can()` to decide which controls to render. A control is rendered only when `can()` is `ok` for the current resource; read-only sections render `ownerLabel` with a lock icon (M15 AC7, AC8).
- State preconditions (for example "a product is at Ramp-up or BAU", "handoff status is Sent") are checked in the service after `can()` and return 409 `invalid_state` with the story copy.

#### 4.1.4 "Owned by <Team>" label rules

- Exactly 8 strings exist: "Owned by Sales", "Owned by Ops", "Owned by Customer Success", "Owned by Network", "Owned by Compliance", "Owned by Finance", "Owned by Sales and Customer Success", "Owned by Sales and Finance".
- The label comes from `AreaPolicy.ownerLabel`, never from string-building at the call site.
- It shows only to viewers without E on that section, placed in the section header (or per field group when ownership is mixed inside a card, M15 AC8), with a lock icon, text in `--color-text-secondary`. Fields stay selectable.
- Champion and Decision maker contacts in the Customer context always show "Owned by Sales and Customer Success", before and after every handoff (resolution 47).
- Commercial terms always show "Owned by Sales and Finance" (D3).
- Products & onboarding shows "Owned by Ops" on the tab header and stage controls; Sales still sees "Edit target go-live" and "Edit product line".
- The owner block in the header never carries a label. Non-CS users see a lock icon in place of "Reassign owner" with the tooltip "Owned by Customer Success" (resolution 43).

#### 4.1.5 403 behaviour

| Case | Server response | UI |
|---|---|---|
| Write outside the matrix | `403 {"error":"forbidden","owner_team":"Compliance"}`. Nothing written to data or audit (M15 AC9). | Toast "You can't edit this. Owned by <Team>. Your team: <Team>." (`<Team>` uses display names). Discard the unsaved values for that section and re-render it read-only (`router.refresh()`) (M15 AC10). |
| Right team, wrong person (confirm pickup, accept, decline, note edit, action item toggle) | `403 {"error":"not_recipient"}` or `{"error":"not_author"}` | Toast "Action not saved", re-render. The control is not rendered for these users in the first place. |
| Write on a soft-deleted entity | `409 {"error":"entity_deleted"}` | "This record was deleted. Contact the admin to reactivate it." |
| Audit tab API for other teams | `GET /api/entities/{id}/audit` → 403 (M16 AC4) | Tab not rendered. Direct URL renders "The audit log is visible to Compliance and the admin." with "Open the Overview". |
| Admin pages for non-admin | API 403 | Page "You don't have access to Admin. Ask Adrian Koh (Ops)." with "Go to Home". |
| Roles & permissions for teams other than Compliance and non-admin | API 403 | Same Admin access page. |
| Wizard for non-Sales | API 403 | Page "Only Sales can create a customer record" with link "Go to search" (M2 AC1). |
| "View as" switches to a user who cannot see the current page | n/a | Redirect to Home with toast "You don't have access to that page as <team>" (resolution 59). |
| Reset demo data when `DEMO_MODE` is off | 404 (M16 AC16) | Control not rendered. |

#### 4.1.6 Audit and Admin page visibility

| Page | Who sees it | Notes |
|---|---|---|
| Entity Audit tab | Compliance users, the admin | Read-only for both. On a soft-deleted entity only the admin sees it. |
| Admin menu entry | The admin (full menu), Compliance (Roles & permissions only) | Not rendered for anyone else (M15 AC12). Gold "Admin" badge for the admin only. |
| Admin > Users & roles (with Change history) | Admin only | |
| Admin > Deleted records | Admin only | |
| Admin > Roles & permissions | Admin, Compliance | Generated from `PERMISSION_MATRIX`. No edit controls. Notes under the table: "The admin flag (Adrian Koh, Ops) adds Users & roles, Deleted records, Roles & permissions, the Audit tab and Reset demo data. It adds no edit rights on data." and "In the Partner context every contact role is owned by Network, except Billing, which Finance owns." |
| Reset demo data | Admin, only when `DEMO_MODE=true` | Last item of the admin sub-navigation and Admin menu. |

Admin user-management rules: the admin cannot change their own team ("The admin must stay on the Ops team in this version.", M15 edge case 1). Adding a user requires name, valid email, team; duplicate email shows "A user with this email already exists" (M15 AC6). A team change writes one audit entry (object `User`, field `Team`, old, new, actor = admin) and shows in Change history (M15 AC5, AC14, resolution 56).

---

### 4.2 Audit and history

#### 4.2.1 One service layer, one transaction

Every write goes through `mutate()`, which opens a Prisma interactive transaction, runs the change, writes the audit entries and the History event (if any) in the same transaction (M16 AC1). If anything fails, nothing is written.

```ts
// src/server/audit/mutate.ts
export async function mutate<T>(
  user: SessionUser,
  ctx: { entityId: string | null; reason?: string },
  fn: (tx: Prisma.TransactionClient, log: AuditLogger) => Promise<T>,
): Promise<T>;

interface AuditLogger {
  /** one AuditEntry per changed field; skips fields where old === new */
  change(c: { objectType: AuditObjectType; objectId: string; objectLabel: string;
              field: string; oldValue: unknown; newValue: unknown; reason?: string;
              source?: 'USER' | 'SYSTEM_GLEIF' }): void;
  /** diff helper: logs every changed key of two plain objects */
  diff(o: { objectType: AuditObjectType; objectId: string; objectLabel: string }, before: object, after: object, fields: string[]): void;
  /** zero or one History event per user action */
  history(e: { category: HistoryCategory; text: string; inline?: string; handoffId?: string }): void;
}
```

#### 4.2.2 What every audit entry stores (M16 AC2)

```prisma
model AuditEntry {
  id           String   @id @default(cuid())
  changeSetId  String                       // groups the entries of one user action
  entityId     String?                      // null only for User (team change) entries
  entityName   String?                      // legal name at the time of the change
  objectType   AuditObjectType              // LegalEntity, CustomerRole, PartnerRole, CoverageRow, ProductLine, Contact, KybCheck, PeriodicReview, Obligations, BillingProfile, Handoff, OwnerAssignment, Note, ActionItem, Group, Contract, User, RecordStatus
  objectId     String
  objectLabel  String                       // "Contact: Priya Nair (Incident)", "Coverage row: GB / UK CoP", "KYB: Licence", "Product line: EU VoP / DE"
  field        String                       // "Status", "Expiry date", "Owner", "Record status"
  oldValue     String?                      // null renders "(none)"
  newValue     String?                      // null on removal renders "(removed)"
  reason       String?                      // skip/back/block/cancel/target/decline/cancel/reassign/delete/override reasons
  userId       String?                      // acting user (impersonated "View as" user in demo)
  userName     String
  userTeam     Team                         // team at the time of the change, never rewritten (M16 edge case 5)
  source       AuditSource @default(USER)   // USER | SYSTEM_GLEIF ("System (GLEIF)", requested by userName)
  createdAt    DateTime @default(now()) @db.Timestamptz
  @@index([entityId, createdAt(sort: Desc)])
}
```

- Values are serialised to display strings at write time (dates as `02 Oct 2026`, enums as their UI labels, money with currency, lists joined with ", ", objects as compact JSON). This keeps the log readable after enum renames.
- One entry per changed field. A create writes one entry per field set, with `oldValue = null` (M2 AC17). Unchanged fields write nothing.
- Searching and viewing write nothing (M1 AC17). Denied attempts write nothing (M16 out of scope).
- Changes made through "View as" are logged as the impersonated user and team (M16 edge case 2).
- Additional logged events with no field change of their own: duplicate override (field `Duplicate override`, reason), country override, invalid LEI status override, owner acknowledgement (object `OwnerAssignment`, field `Acknowledged`), GLEIF refresh (`source = SYSTEM_GLEIF`).

#### 4.2.3 Immutability (M16 AC3)

- No API route updates or deletes `AuditEntry` rows. The Prisma client wrapper exposes `create` and `findMany` only for this model.
- Migration `0002_constraints` (3.2.3) adds a Postgres trigger that raises an exception on `UPDATE` or `DELETE` of `"AuditEntry"`, and `prisma/grants.sql` gives the application role (`hub_app`) only `SELECT, INSERT` on the table (3.1.4). The application connects as `hub_app` (`DATABASE_URL`); migrations, the seed and the demo reset connect as the owner role `hub_owner` (`DATABASE_ADMIN_URL`).
- "Reset demo data" is the only path that removes audit entries. It uses `TRUNCATE` with the owner role (the row trigger does not fire on `TRUNCATE`) and exists only when `DEMO_MODE=true` (M16 AC16).

#### 4.2.4 History timeline: notes plus events

The History tab merges two sources, newest first, 50 per page with "Load more" (M10 AC7): `Note` rows (sorted by `createdAt`, interaction date shown on the card) and `HistoryEvent` rows written by `log.history()`.

```prisma
model HistoryEvent {
  id          String          @id @default(cuid())
  entityId    String
  changeSetId String          // links to the AuditEntry rows for "View audit details"
  category    HistoryCategory // STAGE_CHANGE | CONTACT_CHANGE | HANDOFF | OWNER_REASSIGNED | NETWORK_AND_STRUCTURE | OTHER_FIELD_CHANGES
  text        String          // "EU VoP / DE: UAT → Go-live approval (entered 01 Oct 2026). By Adrian Koh, Ops"
  inline      String?         // old → new values shown inline to teams without audit access, e.g. "Payment term: 30 → 45 days"
  handoffId   String?         // "View handoff summary" link
  actorId     String?
  actorName   String
  actorTeam   Team
  createdAt   DateTime        @default(now()) @db.Timestamptz
}
```

Events are immutable: no edit or delete control, no update route (M10 AC6). Which writes produce which event:

| Category (filter label) | Writes that produce an event | Example text |
|---|---|---|
| Stage change | Stage forward, skip, back ("Stage moved back"); mark blocked; edit block; resolve block (with duration); "Billable from date removed"; product line added, edited, cancelled; target go-live changed | "EU VoP / DE: UAT → Go-live approval (entered 01 Oct 2026). By Adrian Koh, Ops"; "UK CoP / GB marked blocked by Partner: partner bank sandbox unavailable"; "UK CoP / GB block resolved after 6 days"; "Product line added: EU VoP, AT, target go-live 16 Dec 2026"; "Product line cancelled: EU VoP / DE. Reason: <reason>" |
| Contact change | Contact added; role, email, phone or availability changed; marked Left; restored to Active; primary incident contact changed | "Incident contact changed: Primary is now Paul Grant (was Marta Kovacs). By Lukas Brenner, Network." |
| Handoff | Sales → Ops sent, recipient changed, confirmed (plus the owner change line); Ops → CS sent, accepted (with owner change), declined, cancelled. Each links to the handoff summary | "Handoff sent to Adrian Koh by Tom Hadley"; "Onboarding Manager changed from Adrian Koh to Kevin Lim by Tom Hadley"; "Handoff confirmed by Adrian Koh"; "Owner changed from Tom Hadley to Adrian Koh"; "Handoff to Customer Success sent to Emma Wilson by Adrian Koh"; "Handoff accepted by Emma Wilson. Owner: Adrian Koh → Emma Wilson"; "Handoff declined by Emma Wilson: <reason>"; "Handoff cancelled by Adrian Koh: <reason>" |
| Owner reassigned | M9 reassign or set owner | "Owner reassigned: Leo Martin → Sophie Mitchell. Reason: Leo on parental leave until February 2027. By Emma Wilson, Customer Success" |
| Network and structure | Coverage row created, status changed (incl. scheduled), connection method changed (M5); role added or removed, group link, unlink, move, contract reference attached, edited or removed, invoiced entity changed, partner agreement reference attached (M4); "Record created" (M2 AC18); lifecycle Inactive / active; soft delete and reactivation | "Coverage GB / UK CoP: Active → Degraded (effective 02 Oct 2026). Reason: Response times above 2s on CoP requests. By Lukas Brenner, Network."; "Connection method: Direct → Via routing provider (ClearRoute Services)"; "Role added: Network partner"; "Linked to group Santander by Adrian Koh"; "Moved from <group A> to <group B>"; "Contract IPE-MSA-2026-014 attached"; "Invoiced entity changed to <entity>"; "Record created by Tom Hadley (Sales)"; "Lifecycle state: Live → Inactive. Reason: <reason>. By Adrian Koh, Ops" |
| Other field changes | Every other audited change: entity core fields, commercial terms ("Commercial terms changed"), handoff summary, renewal date, KYB checks, GLEIF refresh, periodic review, obligations, billing profile, "Duplicate warning acknowledged: <reason>", "LEI status override: <reason>", country override | "Commercial terms changed" with inline "Payment term: 30 → 45 days" |
| Incident | Every issue write (4.9.11): reported, added report, routed, acknowledged, status change, resolved (incl. cascade), closed, severity or type change, clock outcome, contributor added or removed, reassigned, note added, communication recorded, communicator changed or handed over, Compliance flag and assessment, linked issue created, attached or unlinked. Each event carries `issueId` and the link "Open ISS-<n>". Linked-issue events are written on both entities | "Issue ISS-1043 reported by Emma Wilson (Customer Success): Sev-3, Wrong match result, UK CoP GB"; "ISS-1043 routed to Kevin Lim (Ops), communicator Adrian Koh (Ops)"; "ISS-1042 severity changed from Sev-2 to Sev-1 by Kevin Lim: Second scheme now affected"; "ISS-1042: First notification to Silvia Moretti by Email, recorded by Kevin Lim"; "Compliance assessment: Possible major incident. By Mei Chen, Compliance." |
| (no event, audit only) | Mark as verified (M7 AC15), contact ticks at Ops → CS send, owner acknowledgement, note create and edit (the note card itself is the timeline item), action item toggle | |

Rules:
- A group master agreement change writes the event on every entity that uses the agreement (M4 AC14).
- A product line whose contracting entity differs from the customer record logs on the customer record (where the band lives).
- Event `actorTeam` is the team at the time of the action.
- Audit link visibility (resolution 50, M10 AC5): Compliance users and the admin see "View audit details" on events, which opens the Audit tab filtered to the event's `changeSetId`. All other teams see `inline` (old and new values) and no link.

#### 4.2.5 History filters (M10 AC8, AC9, resolution 49)

| Filter | Values | Default |
|---|---|---|
| Team (multi-select) | Sales, Ops / Onboarding, Customer Success, Network, Compliance, Finance. Author's team for notes, actor's team for events | all selected |
| Event type (multi-select) | Call, QBR, Negotiation, Incident, Payment, Other (note types); Stage change, Contact change, Handoff, Owner reassigned, Network and structure, Other field changes (event categories) | all selected except "Other field changes" |
| "Open action items only" toggle | Shows only notes with at least one Open action item | off |

- OR within a filter, AND across filters. "Reset filters" restores the defaults. Selections persist in `sessionStorage` for the browser session (wrapped in try/catch).
- Issue flow (milestone 6A): the Event type value "Incident" matches the note type Incident and the event category `INCIDENT` together (3.3.5), so issue events are in the default set.
- An action item that is Open with a due date before today shows "Overdue".

#### 4.2.6 Notes

- Any team adds notes on a non-deleted entity (M10 AC1). Fields and validation per M10 AC2, AC3.
- Edit window: the author only, for 24 hours after `createdAt`, measured server-side at save time on UTC timestamps. After 24 hours the note is read-only for everyone, including the author and the admin. A save that arrives after the window returns 409 and shows "The edit window for this note has closed"; the note stays unchanged (M10 AC11, edge case 1). Edited notes show "Edited <date, time>"; each edit writes old and new values to the audit log.
- No note deletion (M10 AC12).
- Action item status toggles between Open and Done by the note author or the action item owner, at any time, independent of the 24-hour window; records who and when; audit entry (M10 AC10).
- Participants are stored as snapshots (name at save time) plus optional user or contact ID, so a later "Left" contact shows "Former contact" and a deactivated user shows "Inactive user".

#### 4.2.7 Audit tab behaviour (M16 AC4 to AC7)

Newest first, 50 per page, filters Field (multi), User (multi), Date range (local dates, inclusive), AND-combined, count "23 changes". Values over 200 characters truncate with "Expand". No edit or delete controls.

---

### 4.3 Onboarding stage engine

#### 4.3.1 Stages

```ts
export const STAGES = [
  'CONTRACT_SIGNED',          // 1 Contract signed
  'KICKOFF',                  // 2 Kickoff
  'SANDBOX_TECHNICAL_INTEGRATION', // 3 Sandbox & technical integration
  'TESTING_CERTIFICATION',    // 4 Testing & certification
  'UAT',                      // 5 UAT
  'GO_LIVE_APPROVAL',         // 6 Go-live approval
  'LIVE_HYPERCARE',           // 7 Live & hypercare
  'RAMP_UP',                  // 8 Ramp-up
  'BAU',                      // 9 BAU
] as const;
export const stageIndex = (s: Stage) => STAGES.indexOf(s) + 1;   // 1..9
export const isLiveOrLater = (s: Stage) => stageIndex(s) >= 7;
```

The 9 stages, their order and names are fixed (M6 out of scope: configurable stages).

#### 4.3.2 Product line model and invariants

```prisma
model ProductLine {
  id                  String    @id @default(cuid())
  customerEntityId    String    // the customer record that holds the band (M6 AC21)
  contractingEntityId String    // this entity or another entity of the same group
  scheme              Scheme    // EU_VOP | UK_COP | GLOBAL_VALIDATION
  country             String    // ISO 3166-1 alpha-2
  targetGoLive        DateTime  @db.Date
  currentStage        Stage     @default(CONTRACT_SIGNED)
  stageEnteredOn      DateTime  @db.Date
  skippedStages       Stage[]   // shown as "Skipped" on the band
  billableFrom        DateTime? @db.Date
  status              LineStatus @default(ACTIVE)   // ACTIVE | CANCELLED
  cancelledOn         DateTime? @db.Date
  cancelReason        String?
  version             Int       @default(0)
  transitions         StageTransition[]
  blocks              ProductBlock[]
  @@unique([customerEntityId, scheme, country, contractingEntityId])
}
model StageTransition { id String @id; productLineId String; fromStage Stage?; toStage Stage; enteredOn DateTime @db.Date; kind TransitionKind /* INITIAL|FORWARD|SKIP|BACK */; note String?; reason String?; userId String; createdAt DateTime @default(now()) }
model ProductBlock    { id String @id; productLineId String; blockedBy BlockParty /* CUSTOMER|Corvane|PARTNER */; reason String; blockedSince DateTime @db.Date; resolvedOn DateTime? @db.Date; resolutionNote String?; createdById String; resolvedById String? }
```

- At most one open block (`resolvedOn = null`) per line. `blocked` = an open block exists.
- Product rules on add and edit (M3 AC1 to AC3): UK CoP only `GB`; EU VoP only SEPA countries (static list in config); Global validation any country; product + country + contracting entity unique within the customer; target go-live a valid date, not in the past ("Target go-live is in the past"), and not earlier than the signing date of the customer's contract reference when one exists ("Target go-live cannot be earlier than the contract signing date", M6 edge case 6). The contracting entity picker lists this entity and the other entities of its group.

#### 4.3.3 Stage changes (Ops only)

One "Change stage" dialog. Let N = current stage index, M = picked stage index (M ≠ N).

| Move | Condition | Required input | Effects |
|---|---|---|---|
| Forward | M = N + 1 | Entry date; optional note (max 500) | `currentStage = M`, `stageEnteredOn = entry date`, transition `FORWARD` |
| Skip | M > N + 1 | Entry date; reason 5 to 500 | As forward; stages N+1..M-1 appended to `skippedStages`; transition `SKIP` with reason. Helper "Stages UAT and Go-live approval will be marked as Skipped" |
| Back | M < N | Entry date; reason 5 to 500 | `currentStage = M`; `skippedStages` loses every stage ≥ M (they return to future style); transition `BACK` labelled "Stage moved back" in History and audit. Helper "Moving back from <stage N> to <stage M>" |

Validation for every move:
- Entry date default today; not after today ("Entry date cannot be in the future"); not before the current `stageEnteredOn` ("Entry date cannot be earlier than <date> (current stage date)").
- Line status must be `ACTIVE` (cancelled lines have no stage controls).
- `version` must match, otherwise 409 "This stage was updated by another user. Reload to see the latest stage." (M6 edge case 5).

Side effects in the same transaction:
1. "Days in stage" resets: it is always `daysBetween(stageEnteredOn, today)`, so it reads 0 on the day of the move.
2. Billable from (M6 AC11):
   - from a stage before Live & hypercare to Live & hypercare or later: `billableFrom = entry date` of this move;
   - between stages that are both Live & hypercare or later (for example Live & hypercare → Ramp-up): `billableFrom` unchanged;
   - from Live & hypercare or later back to a stage before Live & hypercare: `billableFrom = null`, History "Billable from date removed"; the dialog warns "The Billable from date will be removed."
3. Open block: stays open (M6 AC9). The dialog shows it with a "Resolve block" checkbox, unchecked by default; when ticked, the block is resolved in the same transaction (4.3.4).
4. Lifecycle state recomputed (4.3.6).
5. Audit: one entry per changed field (`Stage`, `Stage entry date`, `Skipped stages`, `Billable from`) with the reason; History event (Stage change).

The band shows "Go-live overdue by n days" (n = `daysBetween(targetGoLive, today)`) when today > `targetGoLive` and the stage is before Live & hypercare (M6 AC10).

#### 4.3.4 Block and resolve (Ops only)

| Action | Input | Effects |
|---|---|---|
| Mark as blocked | Blocked by (Customer, Corvane, Partner); reason 5 to 500 | Creates `ProductBlock` with `blockedSince = today`. Badge "Blocked by Customer since 24 Sep 2026: <reason>". Rejected with 409 if a block is already open |
| Edit block | Blocked by, reason | Updates the open block; `blockedSince` unchanged; audit per field; History event |
| Resolve block | Optional resolution note (max 500) | `resolvedOn = today`; History "<product> / <country> block resolved after <n> days", n = `daysBetween(blockedSince, today)` |

A block stays open across any stage change, including a move to BAU, until resolved (M6 edge case 4).

#### 4.3.5 Add, edit, cancel product lines; target go-live

| Action | Who | Rules |
|---|---|---|
| Add product line | Ops | Product, country, contracting entity, target go-live with 4.3.2 rules. Starts at Contract signed, `stageEnteredOn = today`, transition `INITIAL`. History "Product line added: <product>, <country>, target go-live <date>" (M6 AC18). |
| Edit product line (product, country, contracting entity) | Ops, Sales | 4.3.2 rules; reason 5 to 500 required; stage data unchanged. |
| Edit target go-live | Ops, Sales | New date with 4.3.2 rules; reason 5 to 500 required; audited with reason; History event (M6 AC10). |
| Mark as cancelled | Ops | Reason 5 to 500. `status = CANCELLED`, `cancelledOn = today`. Lines are never deleted. A cancelled band moves to "Cancelled product lines (n)", greyed, chip "Cancelled on <date>" and the reason, no actions. Cancelled lines are excluded from every worklist rule, from the lifecycle calculation, from the Ops → CS enablement rule, from the Ops → CS product snapshot and from the Overview alerts. Any open block on the line is left as is but ignored. |

#### 4.3.6 Lifecycle state

`Entity.lifecycleState` is stored (for search filtering) and recomputed by `recomputeLifecycle(tx, entityId)` inside every transaction that adds, edits, cancels or moves a product line, adds a coverage row or changes a coverage status, changes the roles, and on "Mark as active".

```ts
function computeLifecycle(
  entity: { lifecycleState: LifecycleState; customerRoleActive: boolean; partnerRoleActive: boolean },
  lines: ContractedProduct[],
  coverageStatuses: CoverageStatus[],   // current (effective today) status of each coverage row
): LifecycleState {
  if (entity.lifecycleState === 'INACTIVE') return 'INACTIVE';  // set only by Ops (Details tab)
  if (entity.partnerRoleActive && !entity.customerRoleActive) {  // partner-only (decision B1)
    return coverageStatuses.some(s => s === 'ACTIVE' || s === 'DEGRADED') ? 'LIVE' : 'ONBOARDING';
  }
  const active = lines.filter(l => l.cancelledAt === null);
  if (active.length === 0) return 'ONBOARDING';
  if (active.every(l => l.stage === 'BAU')) return 'BAU';
  if (active.some(l => isLiveOrLater(l.stage))) return 'LIVE';
  return 'ONBOARDING';
}
```

- Partner-only entities (decision B1): Live when at least one coverage row is Active or Degraded today, otherwise Onboarding; Inactive when Ops marks it. The Details "Lifecycle state" card reads "Computed from partner coverage" for them.

- The lines counted are those with `customerEntityId = entity.id`.
- Inactive: Ops uses "Mark as inactive" with a reason (10 to 500) and "Mark as active" to recompute. Stage changes never alter Inactive (M6 AC12). An Inactive entity stays editable per the matrix, is hidden from search by default (lifecycle filter defaults to everything except Inactive), never appears in worklists and gets no billing flag.
- A change of the computed state writes an audit entry (field `Lifecycle state`) inside the same change set; it does not create its own History event (the stage event already covers it). Inactive and active changes create a "Network and structure" event.

#### 4.3.7 Where the band lives

The band and its controls live on the customer record (`customerEntityId`). When `contractingEntityId` is another entity of the group, that entity's Overview lists the product read-only with "Contracted for <customer>" and a link to the customer record (M6 AC21, resolution 45). Products & onboarding is hidden for partner-only entities (resolution 46).

---

### 4.4 Handoffs

#### 4.4.1 Model

```prisma
model Handoff {
  id            String         @id @default(cuid())
  entityId      String
  type          HandoffType    // SALES_TO_OPS | OPS_TO_CS
  status        HandoffStatus  // SENT | CONFIRMED | ACCEPTED | DECLINED | CANCELLED
  fromUserId    String
  toUserId      String
  snapshot      Json           // frozen summary taken at send/submit (resolution 32, M8 AC3)
  noteForCsm    String?        // OPS_TO_CS, max 1,000
  sentAt        DateTime       @db.Timestamptz
  sentOn        DateTime       @db.Date   // Europe/Bucharest date of sentAt, for day counts
  closedAt      DateTime?      @db.Timestamptz
  closedById    String?
  closeReason   String?        // decline or cancel reason, 10 to 500
  version       Int            @default(0)
}
```

At most one `SENT` handoff of each type per entity. The service enforces this inside the transaction (409 on a second).

#### 4.4.2 Sales → Ops

```mermaid
stateDiagram-v2
  [*] --> Sent: Sales submits wizard (M3 AC10)
  Sent --> Sent: Sales changes Onboarding Manager (resolution 36)
  Sent --> Confirmed: named Onboarding Manager confirms pickup (M3 AC12)
  Confirmed --> [*]
```

| Transition | Who (beyond `can()`) | Preconditions | Effects | Audit / History |
|---|---|---|---|---|
| create → Sent | The Sales user submitting the wizard | Wizard valid; chosen recipient is an active Ops user | In the wizard transaction: entity (or Customer role on an existing partner entity, M2 AC13), Customer role, product lines at Contract signed with `stageEnteredOn = today`, contacts, group from the GLEIF parent if chosen, Handoff with `snapshot` of steps 1 to 4. Owner = the Sales user for a new entity; unchanged for an existing partner entity until confirmation | Field-level audit entries; History "Record created by <name> (Sales)", override events, "Handoff sent to <OM> by <Sales user>" |
| Sent → Sent (recipient change) | Any Sales user | Status Sent; new recipient active Ops user, different from current | `toUserId` changes; item moves to the new recipient's "To pick up"; Sales "Awaiting pickup" shows the new name | Audit field `Recipient`; History "Onboarding Manager changed from <old> to <new> by <Sales user>" |
| Sent → Confirmed | Only `toUserId`, and only while that user is in Ops | Status Sent; entity not deleted | `status = CONFIRMED`, `closedAt = now`; entity owner = recipient, `ownerSince = today`; unacknowledged M9 items on the entity are superseded (4.5) | Audit `Status` Sent → Confirmed and `Owner` old → new; History "Handoff confirmed by <OM>" and "Owner changed from <Sales user> to <OM>" |

There is no Decline and no Cancel for Sales → Ops (D2, phase 2).

#### 4.4.3 Ops → CS

```mermaid
stateDiagram-v2
  [*] --> Sent: any Ops user sends (M8 AC9)
  Sent --> Accepted: chosen CSM, while in CS (M8 AC11)
  Sent --> Declined: chosen CSM, while in CS, reason (M8 AC12)
  Sent --> Cancelled: any Ops user, reason (M8 AC13, resolution 33)
  Accepted --> [*]
  Declined --> [*]
  Cancelled --> [*]
```

Enablement of "Hand over to Customer Success" (resolution 38, M8 AC1, AC2):
- Rendered for every Ops user, whoever the current owner is.
- Enabled when the entity has at least one `ACTIVE` customer product line at Ramp-up or BAU and no Ops → CS handoff with status Sent. Otherwise disabled with the tooltip "Available when at least one product has completed hypercare".
- When an Ops → CS handoff is Sent, the button is replaced by the banner "Handoff to <CSM> pending since <date>".
- The server re-checks both conditions on send and returns 409 when they fail.

| Transition | Who (beyond `can()`) | Validation | Effects | Audit / History |
|---|---|---|---|---|
| create → Sent | Any Ops user | Enablement rule; at least one active Customer-context Incident contact ("Add an active incident contact before handing over"); a handoff note (max 300) per open block; at least one commitment (description 5 to 300, optional due date) or "No open commitments" ticked; every Ops-owned customer contact ticked "Confirmed"; receiving CSM is an active CS user; note for the CSM max 1,000. No active Champion only warns ("No active champion. The CSM will need to identify one") | `snapshot` holds sections 1 to 4 and the note; each ticked contact gets `lastVerifiedOn = today`, `verifiedBy = sender` in the same transaction (resolution 34). Owner unchanged until acceptance | Audit `Status` (none) → Sent plus contact verification entries; History "Handoff to Customer Success sent to <CSM> by <Ops user>" |
| Sent → Accepted | Only `toUserId`, and only while that user's team is CS (resolution 37) | Entity not deleted | Owner = CSM, `ownerSince = today`; Champion and Decision maker keep "Owned by Sales and Customer Success"; unacknowledged M9 items on the entity are superseded | Audit `Status` and `Owner`; History "Handoff accepted by <CSM>. Owner: <old> → <CSM>" |
| Sent → Declined | Only `toUserId`, while in CS | Reason 10 to 500 | Owner unchanged; sender sees "Handoff declined by <CSM>: <reason>"; the button becomes available again | Audit `Status` with reason; History "Handoff declined by <CSM>: <reason>" |
| Sent → Cancelled | Any Ops user | Reason 10 to 500 | A new handoff, to any CSM, is allowed | Audit `Status` with reason; History "Handoff cancelled by <Ops user>: <reason>" |

Snapshot shape (frozen; later record edits never change it, M8 AC14):

```ts
type OpsCsSnapshot = {
  products: { scheme: Scheme; country: string; stage: Stage; stageEnteredOn: string; billableFrom: string | null }[]; // ACTIVE lines only
  openBlocks: { productLineId: string; product: string; blockedBy: BlockParty; reason: string; blockedSince: string; handoffNote: string }[];
  commitments: { description: string; dueDate: string | null }[] | 'NONE';
  contacts: { contactId: string; role: ContactRole; name: string; email: string; phone: string | null;
              lastVerifiedOn: string | null; ownership: ContactOwnership; confirmed: boolean }[];
  noteForCsm: string | null;
};
type SalesOpsSnapshot = { entity: {...}; products: {...}[]; commercialTerms: {...}; slas: {...}; specialTerms: string | null;
                          contractedEntitiesNotInPortal: string | null; contacts: {...}[]; notesForOnboarding: string | null };
```

Resend after Declined or Cancelled (M8 AC12, resolution 35): the new form prefills block handoff notes (matched by `productLineId` for blocks still open), commitments and the note for the CSM from the latest Declined or Cancelled handoff of the entity. Contact ticks start cleared; Receiving CSM starts empty.

Recipient leaves CS while Sent (resolution 37, M8 edge case 2): Accept and Decline are no longer rendered for that user and the API returns 403 `not_recipient`. The handoff drops out of that user's "To pick up" (they no longer see CS sections). The sender sees the banner "Recipient no longer in Customer Success" on the entity and the handoff, and any Ops user cancels and resends.

#### 4.4.4 Owner changes through handoffs

- Handoff owner changes are separate from M9 reassignment: no reason field, no "Ownership assigned to you" item, History category Handoff (M9 AC12).
- A CS reassignment during a pending Ops → CS handoff is allowed; the dialog warns "A handoff to <CSM> is awaiting acceptance. If <CSM> accepts, he becomes owner." If the CSM later accepts, the owner becomes the CSM (M9 edge case 3).

#### 4.4.5 Soft-delete interactions (M3 edge case 7, M8 edge case 5, resolution 39)

- While the entity is deleted, its Sent handoffs leave every worklist (To pick up, Awaiting acceptance, Awaiting pickup, Handoff declined).
- Confirm pickup, Accept, Decline, Cancel and recipient change on a deleted entity return 409 `entity_deleted` with "This record was deleted. Contact the admin to reactivate it." The handoff status is not changed.
- Non-admins opening the handoff URL see "This record was deleted on <date>. Contact the admin, Adrian Koh, if it should be restored."
- After reactivation the handoff is still Sent and returns to the worklists with its original sent date.

---

### 4.5 Owner assignment (M9)

```prisma
model OwnerAssignment {
  id             String    @id @default(cuid())
  entityId       String
  fromOwnerId    String?   // null for "Set owner"
  toOwnerId      String
  assignedById   String
  reason         String    // 10 to 500
  assignedAt     DateTime  @db.Timestamptz
  acknowledgedAt DateTime? @db.Timestamptz
  supersededAt   DateTime? @db.Timestamptz
}
```

| Rule | Detail |
|---|---|
| Who | CS users only ("Reassign owner", or "Set owner" when the entity has no owner). Hidden for every other team, the admin included; API 403 (M9 AC3, AC4). Unavailable on deleted entities for everyone (409). |
| New owner picker | Active users of CS, Ops and Sales, grouped CS first. Never inactive users. Same as current owner disables "Reassign" with "Select a different owner". |
| Reason | Required, 10 to 500. Error "Reason is required (minimum 10 characters)". |
| Effective date | Today, read-only. |
| Concurrency | The request carries `expectedOwnerId`. If the owner changed meanwhile: 409 "Owner was changed by <name> at <time>. Reload to see the current owner." and no audit entry (M9 edge case 1). |
| Effects | `owner = new`, `ownerSince = today`. Audit entry: object entity, field `Owner`, old, new, reason. History "Owner reassigned" event. Toast "Owner changed to <name>". |
| Notification | If `toOwnerId ≠ actor`, create an `OwnerAssignment` item: Home section "Ownership assigned to you" (entity, previous owner, who reassigned, date, reason) and the Home badge count. Self-assignment creates no item but still writes audit and History (M9 edge case 4). No email (M9 AC9). |
| Consecutive reassignment | Any earlier unacknowledged, unsuperseded assignment on the same entity gets `supersededAt = now`, so only the latest recipient has an item (M9 AC11). The same supersede runs when a handoff changes the owner. |
| Acknowledgement | Only `toOwnerId`. From the Home row ("Acknowledge") or the entity banner "You were assigned as owner on <date> by <name>: <reason>". Sets `acknowledgedAt`; audit entry (object `OwnerAssignment`, field `Acknowledged`); badge count drops by one (M9 AC10). |
| Badge count | Count of the user's assignments with `acknowledgedAt = null`, `supersededAt = null`, entity not deleted and not Inactive. Hidden at 0. |
| Soft delete | Items on a deleted entity are hidden; reactivation shows them again unchanged and never creates a new item (M16 edge case 6). |

The seed includes one unacknowledged assignment for Emma Wilson on UniCredit Bank GmbH from Leo Martin (resolution 5).

---

### 4.6 Worklist engine (M11)

#### 4.6.1 General rules

- Computed at read time from current data on every Home load; no stored list (M11 AC2). Home is a dynamic route (`export const dynamic = 'force-dynamic'`), and every write calls `revalidatePath('/')`, so a resolved item is gone on return without reload (M11 AC20).
- Each section is computed by its own function and rendered in its own Suspense boundary, so a slow or failed section shows a skeleton or "Could not load this list" with "Retry" while the others render.
- "Today" is `today()` in Europe/Bucharest; all comparisons are date-only (M11 AC2).
- Excluded always: soft-deleted entities, Inactive entities, cancelled product lines (M11 AC21, M6 AC19).
- Issue flow (milestone 6C): every team's Home starts with the "Issues" section (4.6.9, M20 AC1), above the M11 section orders below. It loads in its own Suspense boundary like every section. The M11 exclusion of Inactive entities does not apply to it: issues on an Inactive entity stay listed (M17 edge case 7); issues on soft-deleted entities leave it (M20 edge case 6).
- Items cannot be dismissed or snoozed; they leave only when data changes, or by Acknowledge for M9 items (M11 AC19). Rows are read-only; the only inline action is "Acknowledge" (M11 AC25, resolution 13).
- One item per rule match: a product that is blocked and over threshold appears in both sections (M11 edge case 1).
- Scope (M11 AC3, resolutions 8 to 10): default "Mine" for every team and after every "View as" switch. Ops and CS get a "Mine / My team" toggle; Sales sees "Customers you created"; Compliance, Network and Finance see "All institutions" with no toggle.

Entity scope sets used by Ops and CS entity rules:

| Scope | Ops entity set | CS entity set |
|---|---|---|
| Mine | `owner = me`, plus entities whose latest Accepted Ops → CS handoff was sent by me (resolution 10) | `owner = me` |
| My team | owner is any Ops user, or no owner (M11 edge case 6), plus every entity with an Accepted Ops → CS handoff | owner is any CS user, or no owner |

Handoff rows use the handoff's own user fields: "Mine" = addressed to me (To pick up) or sent by me (Awaiting acceptance, Handoff declined, Awaiting pickup); "My team" = the same for every user of my team, read-only with the recipient named; Confirm, Accept and Decline stay reserved for the named recipient.

Status chips (M11 AC4, resolution 11), from `d = daysBetween(today, date)`:

| Chip | Condition |
|---|---|
| Overdue | d < 0 |
| ≤30 days | 0 ≤ d ≤ 30 |
| 31-60 days | 31 ≤ d ≤ 60 |
| 61-90 days | 61 ≤ d ≤ 90 |
| 91-120 days | 91 ≤ d ≤ 120 (CS renewals only) |

Stale handoff (M3 AC18, M8 AC13, M11 AC5, AC10, AC24): `businessDaysElapsed(sentOn, today)` counts Monday-to-Friday dates d with `sentOn < d ≤ today`. A Sent handoff is stale when the count is 2 or more. Stale rows show the chip "Waiting <n> days" (n = calendar days since `sentOn`) with a mahogany left rule; on Ops and Sales "To pick up" / "Awaiting pickup" they are pinned to the top.

Sort (M11 AC1, resolution 15): Overdue first; date-based rules then by the soonest date; elapsed-time rules (Blocked, Too long in current stage, Champion left) by the longest elapsed time first; exceptions are named per section. Ties sort alphabetically by legal name.

Configuration constants (no admin screen). Define them once in `src/server/config.ts` (3.3.4, same values); the `WORKLIST` object below groups references to those same constants:

```ts
export const WORKLIST = {
  STAGE_LIMIT_DAYS_EARLY: 21,        // Contract signed .. Go-live approval
  STAGE_LIMIT_DAYS_HYPERCARE: 56,    // Live & hypercare
  GO_LIVE_WINDOW_DAYS: 14,
  RENEWAL_WINDOW_DAYS: 120,
  EXPIRY_WINDOW_DAYS: 90,
  PARTNER_CONTACT_STALE_DAYS: 90,    // stale from 91 days
  BILLING_CONTACT_STALE_MONTHS: 6,
  STALE_HANDOFF_BUSINESS_DAYS: 2,
} as const;
```

#### 4.6.2 Ops / Onboarding

Section order: To pick up, Awaiting acceptance, Handoff declined, Blocked, Go-lives in the next 14 days, Too long in current stage, Required fields empty, Ownership assigned to you.

| Section | Rule | Threshold | Scope (Mine / My team) | Sort | Leaves when | Source data | AC |
|---|---|---|---|---|---|---|---|
| To pick up | `SALES_TO_OPS` handoff, status Sent | Stale at 2 business days | Addressed to me / addressed to any Ops user | Stale first (most days first), then oldest `sentOn` | Confirmed, or Sales changes the recipient | `Handoff` + entity + product lines (earliest target go-live) | M3 AC11, AC18, M11 AC5 |
| Awaiting acceptance | `OPS_TO_CS` handoff, status Sent | Highlight at 2 business days; "Recipient no longer in Customer Success" when the recipient's team is no longer CS | Sent by me / sent by any Ops user | Highlighted first, then oldest sent | Accepted, declined or cancelled | `Handoff`, recipient `User.team` | M8 AC9, AC13, M11 AC5 |
| Handoff declined | Latest `OPS_TO_CS` handoff of the entity has status Declined | none | Sent by me / sent by any Ops user | Newest decline first | A newer Ops → CS handoff exists for the entity | `Handoff` | M8 AC12, M11 AC5 |
| Blocked | Active line with an open block | none | Ops entity set | Most days blocked first | Block resolved | `ProductBlock` (open), `ProductLine` | M6 AC7, AC14, M11 AC7 |
| Go-lives in the next 14 days | `today ≤ targetGoLive ≤ today + 14` and stage before Live & hypercare | 14 days inclusive; chip ≤30 days | Ops entity set | Soonest target first | Stage reaches Live & hypercare, or target leaves the window | `ProductLine` | M3 AC18, M6 AC14, M11 AC8 |
| Too long in current stage | `daysBetween(stageEnteredOn, today)` > limit; Ramp-up and BAU excluded | 21 days (stages 1 to 6), 56 days (stage 7) | Ops entity set | Oldest `stageEnteredOn` first | Stage changes | `ProductLine` | M6 AC14, M11 AC6 |
| Required fields empty | Entity with an active Customer role and at least one active line in stages 1 to 7, missing any of: LEI; entity type; country; contract reference ("No contract attached"); active Customer-context Technical contact; active Customer-context Incident contact; target go-live on every line before Live & hypercare; group decision ("Group not set") | none | Ops entity set | Most missing fields first | All listed fields filled | `LegalEntity`, `CustomerRole.contractId`, `Contact` (ownership OPS only), `ProductLine`, `groupDecision` | M2 AC19, M4 AC15, M11 AC9 |
| Ownership assigned to you | My unacknowledged, unsuperseded assignment | none | Always personal | Newest first | Acknowledged or superseded | `OwnerAssignment` | M9 AC9 to AC11, M11 AC12 |

Notes: only Ops-owned contacts count for "Required fields empty" (M11 edge case 4). The group decision counts as filled when `Entity.groupDecision` is `GROUP` or `STANDALONE` (3.2.4); `NOT_SET` gives "Group not set".

#### 4.6.3 Customer Success

Section order: Ownership assigned to you, To pick up, Renewals in the next 120 days.

| Section | Rule | Threshold | Scope (Mine / My team) | Sort | Leaves when | Source data | AC |
|---|---|---|---|---|---|---|---|
| Ownership assigned to you | My unacknowledged, unsuperseded assignment | none | Always personal | Newest first | Acknowledged (row or banner), or superseded | `OwnerAssignment` | M9 AC9 to AC11, M11 AC12 |
| To pick up | `OPS_TO_CS` handoff, status Sent, recipient currently in CS | Highlight at 2 business days | Addressed to me / addressed to any CS user | Highlighted first, then oldest sent | Accepted, declined or cancelled, or the recipient leaves CS | `Handoff` | M8 AC10, AC13, M11 AC10 |
| Renewals in the next 120 days | Active Customer role with `renewalDate ≤ today + 120` (passed dates included, labelled "Renewal date passed") | 120 days; chips Overdue, ≤30, 31-60, 61-90, 91-120 | CS entity set | Overdue first, then soonest | Renewal date set more than 120 days away | `CustomerRole.renewalDate` | M11 AC11 |

#### 4.6.4 Compliance

One section, "KYB and review expiries", with bucket sub-headers Overdue, ≤30 days, 31-60 days, 61-90 days. Scope: all institutions.

| Item type | Rule | Threshold | Sort | Leaves when | Source data | AC |
|---|---|---|---|---|---|---|
| Licence | Licence check with `expiryDate ≤ today + 90`; "No expiry date" never listed | 90 days | Overdue first, then soonest | Expiry date moved beyond 90 days | `KybCheck(kind=LICENCE)` | M11 AC13, M12 edge cases 2, 3 |
| LEI | LEI check: GLEIF status LAPSED, RETIRED, MERGED, ANNULLED or DUPLICATE, or "LEI not found", shows as Overdue "LEI lapsed in GLEIF" (or the status); otherwise GLEIF next renewal `≤ today + 90`. One item per entity even when both match (M11 edge case 2) | 90 days | Overdue first, then soonest | Renewal beyond 90 days and GLEIF status ISSUED | `KybCheck(kind=LEI)` (GLEIF status and next renewal of the entity LEI, resolution 16) | M2 AC19, M11 AC13 |
| Periodic review | Review with status Planned or In progress and `nextReviewDate ≤ today + 90`; a passed date reads "Periodic review overdue since <date>" | 90 days | Overdue first, then soonest | Next review date beyond 90 days, or review completed with a new date beyond 90 days | `PeriodicReview` | M11 AC13, M12 AC12, edge case 5 |

#### 4.6.5 Network

| Section | Rule | Threshold | Scope | Sort | Leaves when | Source data | AC |
|---|---|---|---|---|---|---|---|
| Partner contacts not verified for 90+ days | Active contact with `ownership = NETWORK` on an entity with the Network partner role, and `lastVerifiedOn` null or `daysBetween(lastVerifiedOn, today) > 90` | 90 days (exactly 90 excluded) | All institutions | "Never verified" first, then oldest verification | Verified, or marked Left | `Contact` | M7 AC13, M11 AC14, edge cases 3, 4 |

#### 4.6.6 Finance

Section order: Incomplete billing profiles (N), Billing contacts not verified for 6+ months.

| Section | Rule | Threshold | Scope | Sort | Leaves when | Source data | AC |
|---|---|---|---|---|---|---|---|
| Incomplete billing profiles (N) | `incompleteForBilling(entity).flag === true` (4.7.1) | none | All institutions | Most missing or invalid fields first (exception to the general sort) | Flag false | `BillingProfile`, `CustomerRole`, contract | M11 AC16, M14 AC11 |
| Billing contacts not verified for 6+ months | Active contact with role Billing (either context) and `lastVerifiedOn` null or `lastVerifiedOn < addMonths(today, -6)` | 6 calendar months (exactly 6 months excluded) | All institutions | "Never verified" first, then oldest | Verified, or marked Left | `Contact` | M7 AC13, M11 AC15 |

#### 4.6.7 Sales

Section order: Awaiting pickup, Overdue go-lives, Champion left, Ownership assigned to you. Scope: entities with `createdById = me` and Sales → Ops handoffs I sent.

| Section | Rule | Threshold | Scope | Sort | Leaves when | Source data | AC |
|---|---|---|---|---|---|---|---|
| Awaiting pickup | `SALES_TO_OPS` handoff, status Sent, `fromUserId = me` | Stale at 2 business days | Sent by me | Stale first, then oldest sent | Confirmed. A recipient change keeps the item and shows the new name | `Handoff` | M3 AC13, M11 AC24, resolution 12 |
| Overdue go-lives | Active line with `targetGoLive < today` and stage before Live & hypercare, on an entity I created | none; chip Overdue | Created by me | Most days late first | Stage reaches Live & hypercare, or target moved to today or later | `ProductLine` | M3 AC18, M11 AC18 |
| Champion left | Entity I created with at least one Customer-context Champion with status Left and no active Customer-context Champion | none | Created by me | Longest without a champion first (latest leave date, oldest first) | An active Champion exists (new or restored) | `Contact` | M7 AC7, M11 AC17, resolution 17 |
| Ownership assigned to you | As Ops | | Personal | Newest first | Acknowledged or superseded | `OwnerAssignment` | M11 AC12 |

#### 4.6.8 Representative rule sketches

SQL for Ops "Too long in current stage" (parameters: `$today` date in Europe/Bucharest, `$userId`, `$scope`):

```sql
WITH ops_entities AS (
  SELECT e.id
  FROM "LegalEntity" e
  LEFT JOIN "User" o ON o.id = e."ownerId"
  WHERE e."deletedAt" IS NULL
    AND e."lifecycleState" <> 'INACTIVE'
    AND (
      CASE WHEN $scope = 'MINE' THEN
        e."ownerId" = $userId
        OR EXISTS (SELECT 1 FROM "Handoff" h
                   WHERE h."entityId" = e.id AND h.type = 'OPS_TO_CS' AND h.status = 'ACCEPTED'
                     AND h."fromUserId" = $userId
                     AND h."closedAt" = (SELECT max(h2."closedAt") FROM "Handoff" h2
                                         WHERE h2."entityId" = e.id AND h2.type = 'OPS_TO_CS' AND h2.status = 'ACCEPTED'))
      ELSE
        e."ownerId" IS NULL OR o.team = 'Ops'
        OR EXISTS (SELECT 1 FROM "Handoff" h
                   WHERE h."entityId" = e.id AND h.type = 'OPS_TO_CS' AND h.status = 'ACCEPTED')
      END)
)
SELECT pl.id, e."legalName", e.country, pl.scheme, pl.country AS line_country,
       pl."currentStage", pl."stageEnteredOn",
       ($today::date - pl."stageEnteredOn") AS days_in_stage,
       CASE WHEN pl."currentStage" = 'LIVE_HYPERCARE' THEN 56 ELSE 21 END AS limit_days
FROM "ProductLine" pl
JOIN "LegalEntity" e ON e.id = pl."customerEntityId"
WHERE pl."customerEntityId" IN (SELECT id FROM ops_entities)
  AND pl.status = 'ACTIVE'
  AND pl."currentStage" NOT IN ('RAMP_UP', 'BAU')
  AND ($today::date - pl."stageEnteredOn") >
      CASE WHEN pl."currentStage" = 'LIVE_HYPERCARE' THEN 56 ELSE 21 END
ORDER BY pl."stageEnteredOn" ASC, e."legalName" ASC;
```

TypeScript for Ops "To pick up" (business-day staleness and pinning):

```ts
export function businessDaysElapsed(from: LocalDate, to: LocalDate): number {
  let n = 0;
  for (let d = addDays(from, 1); d <= to; d = addDays(d, 1)) {
    const wd = isoWeekday(d);               // 1 = Monday .. 7 = Sunday
    if (wd <= 5) n++;
  }
  return n;
}

export async function opsToPickUp(user: SessionUser, scope: 'MINE' | 'MY_TEAM', today: LocalDate) {
  const rows = await db.handoff.findMany({
    where: {
      type: 'SALES_TO_OPS', status: 'SENT',
      entity: { deletedAt: null, lifecycleState: { not: 'INACTIVE' } },
      ...(scope === 'MINE' ? { toUserId: user.id } : { toUser: { team: 'Ops' } }),
    },
    include: { entity: { include: { productLines: { where: { status: 'ACTIVE' } } } }, fromUser: true, toUser: true },
  });
  return rows
    .map(h => {
      const stale = businessDaysElapsed(h.sentOn, today) >= WORKLIST.STALE_HANDOFF_BUSINESS_DAYS;
      return {
        handoffId: h.id,
        entity: { id: h.entityId, legalName: h.entity.legalName, country: h.entity.country },
        products: h.entity.productLines.map(l => `${schemeLabel(l.scheme)} / ${l.country}`),
        earliestGoLive: min(h.entity.productLines.map(l => l.targetGoLive)),
        sender: h.fromUser.name,
        recipient: scope === 'MY_TEAM' ? h.toUser.name : undefined,
        daysWaiting: daysBetween(h.sentOn, today),
        chip: stale ? `Waiting ${daysBetween(h.sentOn, today)} days` : null,
        canConfirm: h.toUserId === user.id,        // read-only for other Ops users
        href: `/handoffs/${h.id}`,
      };
    })
    .sort((a, b) =>
      Number(!!b.chip) - Number(!!a.chip) ||                       // stale rows pinned to top
      b.daysWaiting - a.daysWaiting ||                             // most days waiting (oldest sent) first
      a.entity.legalName.localeCompare(b.entity.legalName));       // tie-break by legal name
}
```

#### 4.6.9 Issues section (M20, all teams, milestone 6C)

Query `src/server/queries/worklist/issues.ts`, endpoint `GET /api/worklist/issues` (3.8.3). Computed on every load from `now()`; nothing is stored. Before computing rows the query runs the idempotent system writes of 4.9.7 for the issues it touches, so a hand-over that came due is visible in the same response.

**Groups, in this order (M20 AC2, AC5, AC6).** An issue appears once per user, in the highest group that applies.

| Group | An issue that is not Closed where the user is | Clock and step | Sort | Counts in "Issues (n)"; in the badge |
|---|---|---|---|---|
| Main list | the owner; the effective communicator (4.9.7); or the Compliance assessor of a flag with no assessment and no "Neither", once `complianceVisibleFrom` has passed. Rule 4 issues stay out for owner and communicator until `clocksStartAt` (M20 AC8). R2: a Closed issue with an open root cause report task stays for its owner (M27 AC6) | Yes | Below | Every row; rows with at least one step |
| Contributing | an active contributor | No clock, no step. Row: severity, ID, entity, status, "Owner: <name> (<team>)" | Severity, then Corvane aware at | Yes; no |
| Reported by me | the reporter, or the author of an "Add to existing issue" note, with no other role | No clock. Row: severity, ID, entity, status, owner, communicator; a rule 4 issue shows "Queued until <time in the viewer's time zone>" | Severity, then Corvane aware at | Yes; no |

The seeded reporter "Monitoring (automatic)" is no user, so ISS-1042 is in nobody's "Reported by me".

**Steps (M20 AC4, AC14).** One function, `stepsFor(issue, user, now)` in `src/server/derived/issue-steps.ts`, returns the user's steps with their due times:

| Release | Role | Condition | Step | Clock text |
|---|---|---|---|---|
| R1 | Owner | status New | "Acknowledge" | acknowledge clock |
| R1 | Communicator | Sev-1 or Sev-2 with `notifyRequired`, no first notification | "Notify customer" | notification clock |
| R1 | Owner | In progress, Waiting on customer or Waiting on partner | "Resolve" | none |
| R1 | Communicator | Resolved | "Close with the customer" | none |
| R1 | Compliance assessor | flagged, no assessment, not closed by "Neither" | "Assess for Compliance" | assessment clock on Sev-1; none below |
| R2 | Communicator | Sev-1 or Sev-2 after a notification or update, not Resolved | "Send update" | update clock |
| R2 | Communicator | "Possible major incident" recorded, facts pack not sent | "Send facts pack" | facts clock, or "Facts deadline not captured" in red |
| R2 | Communicator | "Possible data breach" recorded, breach notification not recorded | "Notify data breach" | breach clock |
| R2 | Communicator | Waiting on customer for 5 business days | "Remind customer" | none |
| R2 | Owner | root cause report task open | "Send root cause report" | "Root cause report due <date> (in <n> days)" |

A row shows the step with the earliest due time, then "+1 more step" (or "+<n> more steps"). The role label is "Owner", "Communicator", "Owner and communicator" or "Compliance". Linked issues created from a partner issue have no "Acknowledge" step (M20 edge case 8); the owner acknowledges the partner issue.

**Order of the main list (M20 AC3).**

```ts
// rows with an active deadline first, by time left (overdue first, most overdue at the top), then severity, Corvane aware at, ID
rows.sort((a, b) =>
  Number(a.nextDueAt === null) - Number(b.nextDueAt === null) ||
  (a.nextDueAt && b.nextDueAt ? a.nextDueAt.getTime() - b.nextDueAt.getTime() : 0) ||
  SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||          // SEV1 = 1
  a.awareAt.getTime() - b.awareAt.getTime() ||
  a.number - b.number);
```

**Count and badge (M20 AC1, AC9).** "Issues (<n>)" counts every row shown in the section, across the groups that appear (under "My team" only the main list). The Home badge (5.2) becomes the M9 count (4.5) plus the main-list rows with at least one step. It turns red (`--color-danger`) when any counted row is overdue or is a Sev-1 with status New.

**Scope (M20 AC11).** "Mine" shows the user's rows. For Ops and CS, "My team" shows the main-list rows of every active user of the team with the person's name on each row; "Contributing" and "Reported by me" show only under "Mine". M20 AC11 is R1 while the page-wide M11 toggle is R2 (M11 AC3 part), so in R1 the Issues section carries its own "Mine / My team" control for Ops and CS; milestone 12 replaces it with the page toggle. The section is the same component for every team. "View as" keeps one user per team (7.2.2): Kevin Lim's rows reach the demo through Adrian Koh's "My team" scope.

**Refresh (M20 AC10).** The section is a client component that polls the endpoint every `ISSUES_REFRESH_SECONDS` (60) and after `router.refresh()`. Clock texts re-render every 60 seconds from the server's `serverNow` plus the time elapsed in the browser, so they follow the demo clock.

**States.** Empty: the section stays visible with "No issues for you. Report one from the entity record."; the "Contributing" and "Reported by me" headings hide when empty. Loading: two skeleton rows, independent of the M11 sections. Error: "Couldn't load your issues. Retry"; the M11 sections still render and the badge keeps its last known count.

---

### 4.7 Computed flags

All flags are computed at read time and never stored (M14 AC7).

#### 4.7.1 "Incomplete for billing" (M14)

Applies only when all hold (M14 AC6): the entity has an active Customer role; lifecycle state is not Inactive; not soft-deleted; and the entity is its own invoiced entity. A partner-only entity gets no flag and its Billing tab reads "Billing profile not required: partner role only".

Billed through another entity (resolution 55, M14 AC15): when the Customer role's applicable contract has `invoicedEntityId ≠ entity.id`, the profile card shows "Billed through <entity>" linking to that entity's Billing tab, the profile is optional, and there is no flag, badge, banner or worklist row. With no contract attached, the entity counts as its own invoiced entity, and "Contract reference" is reported missing.

The 9 required fields and their checks:

| # | Field | Missing when | Invalid when |
|---|---|---|---|
| 1 | Billing legal name | empty | (no format rule) |
| 2 | Street | empty | |
| 3 | City | empty | |
| 4 | Postal code | empty | |
| 5 | Country | empty | not an ISO 3166-1 alpha-2 code |
| 6 | VAT / tax ID | empty | normalised value (spaces, dots, hyphens stripped, uppercase) fails: EU billing country → must start with that country's VAT prefix (`EL` for Greece) followed by 2 to 12 letters or digits; other countries → 4 to 20 letters or digits |
| 7 | LEI | empty | not `^[A-Z0-9]{18}[0-9]{2}$` or fails ISO 7064 MOD 97-10 |
| 8 | Contracting Corvane entity | empty | value not in the configured list (`"Corvane Singapore Pte. Ltd."`, `"Corvane Europe B.V."`); shown with "No longer in list" |
| 9 | Contract reference | Customer role has no applicable contract (owned by Ops, D1) | |

```ts
export function incompleteForBilling(e: EntityForBilling): { applies: boolean; billedThrough?: EntityRef; flag: boolean; missing: BillingField[]; invalid: BillingField[] } {
  if (!e.customerRoleActive || e.lifecycleState === 'INACTIVE' || e.deletedAt) return { applies: false, flag: false, missing: [], invalid: [] };
  const inv = e.customerRole.contract?.invoicedEntity;
  if (inv && inv.id !== e.id) return { applies: false, billedThrough: inv, flag: false, missing: [], invalid: [] };
  const p = e.billingProfile;                           // may be null: all 9 missing except a contract present
  const missing: BillingField[] = []; const invalid: BillingField[] = [];
  check('Billing legal name', p?.legalName); check('Street', p?.street); check('City', p?.city);
  check('Postal code', p?.postalCode); check('Country', p?.country, isIsoCountry);
  check('VAT / tax ID', p?.vatId, v => isValidVat(v, p!.country)); check('LEI', p?.lei, isValidLei);
  check('Contracting Corvane entity', p?.corvaneEntity, v => CORVANE_ENTITIES.includes(v));
  if (!e.customerRole.contractId) missing.push('Contract reference');
  return { applies: true, flag: missing.length + invalid.length > 0, missing, invalid };
}
```

- Values that reached the database without the save check (seed data) are still format-checked (M14 AC7).
- Billing contacts never count (M14 AC13). A billing LEI that differs from the entity LEI only warns ("Differs from entity LEI <LEI>") and does not affect the flag. A lapsed GLEIF status does not affect the flag (format only).
- Surfaces: header amber badge "Incomplete for billing" for every team, tooltip "Missing: … Invalid format: …", click opens Billing (never rendered before the profile loads); Billing tab banner "Incomplete for billing. Missing: <fields>. Invalid format: <fields>" with a hint "Ops attaches the contract on the Customer role" linking to Details; Finance worklist; Overview alert. The badge and banner clear without reload after the last fix (M14 AC10).

#### 4.7.2 Overview "Active alerts"

Every team sees the same list (resolution 41, M1 AC14, plus M5 AC12, M6 AC10, AC13, M7 AC7, M12 AC15 and scenario decision 8). Sort: carmine first, then mahogany, then soonest date. Each alert links to the tab where it is resolved.

| Alert | Severity | Condition | Copy | Link |
|---|---|---|---|---|
| No active incident contact | Carmine | Customer role active and no active Customer-context Incident contact; or Network partner role and no active Partner-context Incident contact (one alert per context) | "No active incident contact" | Contacts |
| LEI lapsed or invalid | Carmine | Entity LEI GLEIF status LAPSED, RETIRED, MERGED, ANNULLED or DUPLICATE, or LEI not found | "LEI lapsed" / "LEI <STATUS>" / "LEI not found in GLEIF" | Compliance |
| KYB expired | Carmine | Any KYB check computes Expired (the LEI check is covered by the LEI alert above, so it is not repeated) | "Licence expired on 01 Sep 2026" | Compliance |
| Sanctions | Carmine | Sanctions result "Potential match under review" or "Confirmed match" | "Sanctions screening: <result>" | Compliance |
| Periodic review overdue | Carmine | Review status Planned or In progress and `nextReviewDate < today` | "Periodic review overdue since <date>" | Compliance |
| Blocked product | Carmine | Each active line with an open block | "<product> / <country> blocked by <party> since <date>: <reason>" | Products & onboarding |
| Go-live overdue | Carmine | Each active line with `targetGoLive < today` and stage before Live & hypercare | "<product> / <country>: Go-live overdue by <n> days" | Products & onboarding |
| Coverage issue | Mahogany (Degraded), carmine (Suspended) | Each coverage row whose status in force today is Degraded or Suspended (scheduled future statuses ignored) | "Partner coverage issue: <country> / <scheme> <status> since <date>" | Partner |
| Incomplete for billing | Mahogany | `incompleteForBilling().flag` | "Incomplete for billing: <n> fields missing" | Billing |
| Renewal within 30 days | Mahogany | Active Customer role with `renewalDate ≤ today + 30` | "Renewal on <date> (in <n> days)"; a passed date reads "Renewal date passed (<date>)" | Details, Customer role card |
| KYB expiring | Mahogany | Any KYB check computes Expiring | "Licence expires on <date> (in <n> days)" | Compliance |
| No active champion | Mahogany | Customer-context Champion with status Left and no active Champion | "No active champion since <latest leave date>" | Contacts |

Team-specific worklist rules (go-lives in 14 days, too long in stage, required fields empty, renewals beyond 30 days) stay on Home only. Empty: "No active alerts".

#### 4.7.3 Contact verification staleness

| Contact | Stale when | Where it shows |
|---|---|---|
| Active, `ownership = NETWORK`, on an entity with the partner role | `lastVerifiedOn` null ("Never verified") or more than 90 days before today | Network worklist; Contacts tab verification text in mahogany |
| Active, role Billing (either context) | `lastVerifiedOn` null or more than 6 calendar months before today | Finance worklist; Contacts tab verification text in mahogany |
| Any other contact | Never stale in the MVP | Contacts tab shows "Verified <n> days ago by <name>" |

`lastVerifiedOn` and `verifiedById` are set: at creation (today, creator); on "Mark as verified" by the owning team (audit only, no History event); on the Ops → CS send for ticked Ops-owned contacts. Editing other fields leaves them unchanged (M7 AC5). Left contacts never appear.

#### 4.7.4 KYB card status (M12 AC8)

```ts
const INVALID_GLEIF = ['LAPSED', 'RETIRED', 'MERGED', 'ANNULLED', 'DUPLICATE'];

export function kybStatus(c: KybCheck, entity: { lei: string | null; gleifStatus: string | null; gleifNotFound: boolean; gleifNextRenewal: LocalDate | null }, today: LocalDate):
  'NOT_STARTED' | 'VERIFIED' | 'EXPIRING' | 'EXPIRED' {
  if (c.kind === 'LEI') {
    if (!entity.lei) return 'NOT_STARTED';                                   // "No LEI on this entity" (M12 edge case 1)
    if (entity.gleifNotFound || INVALID_GLEIF.includes(entity.gleifStatus ?? '')) return 'EXPIRED';
  }
  if (!c.verifiedOn) return 'NOT_STARTED';                                   // "Not verified yet"
  const expiry = c.kind === 'LEI' ? entity.gleifNextRenewal
               : c.kind === 'LICENCE' && !c.noExpiry ? c.expiryDate
               : null;                                                       // Ownership, Sanctions: no expiry
  if (!expiry) return 'VERIFIED';
  const d = daysBetween(today, expiry);
  if (d < 0) return 'EXPIRED';
  if (d <= 90) return 'EXPIRING';
  return 'VERIFIED';
}
```

| Status | Chip colour | Meaning |
|---|---|---|
| Not started | Grey | No verification saved (or LEI card with no LEI) |
| Verified | `#008148` | Saved, expiry more than 90 days away or no expiry |
| Expiring | `#BA450B` | Expiry from today to today + 90 |
| Expired | `#96031A` | Expiry before today; or LEI GLEIF status LAPSED / RETIRED / MERGED / ANNULLED / DUPLICATE; or LEI not found in GLEIF |

An expired licence date can be saved (it records reality) and shows Expired at once (M12 edge case 2). A link on a host no longer approved shows "Link outside approved storage" and the next edit requires an approved link.

#### 4.7.5 Periodic review status (M12 AC11, AC12)

Stored status: `PLANNED | IN_PROGRESS`, plus `lastReviewDate`, `nextReviewDate` (required once a status is set), `lastCompletedOn`. Displayed status is computed:

| Stored | `nextReviewDate` | Displayed | Secondary marker |
|---|---|---|---|
| Planned | ≥ today | Planned | |
| Planned | < today | Overdue | |
| In progress | ≥ today | In progress | |
| In progress | < today | In progress | "Past due" |
| none | none | "No review scheduled" | |

- Users cannot select Overdue; the dropdown offers Planned and In progress only. A review scheduled with a past next date displays Overdue at once (M12 edge case 5).
- "Complete review": completion date (not in the future) becomes `lastReviewDate`, a new `nextReviewDate` later than it is required, stored status returns to Planned, and the card shows "Completed <date>".
- For worklists and Overview, a review counts as overdue when the stored status is Planned or In progress and `nextReviewDate < today` (both Overdue and "Past due" rows).

---

### 4.8 Soft delete, reactivation and demo reset

#### 4.8.1 Soft delete (M16 AC8 to AC11)

- Admin only, from the entity header "More" menu "Delete record". Dialog "Delete <entity>?" with reason 10 to 500; "Delete" disabled until valid.
- Effects: `deletedAt = now`, `deletedById`, `deleteReason`. One audit entry: object `RecordStatus`, field `Record status`, Active → Deleted, with the reason. History event (Network and structure).
- Nothing else in the database changes. Child data (roles, products, contacts, coverage, KYB, obligations, billing, handoffs, notes, assignments) stays untouched.
- Hidden from: search and typeahead, every worklist and the Home badge, the Obligations view, group tables and group exposure counts (the admin sees "1 deleted entity (visible to admin)"), "To pick up" and every handoff list.
- Opening by URL: non-admins see "This record was deleted on <date>. Contact the admin, Adrian Koh, if it should be restored." with no data, header or tabs. The admin sees the full record read-only under the red banner "Deleted by <name> on <date>. Reason: <reason>" with "Reactivate"; every edit control, Add note, Reassign and Hand over are hidden.
- Every write on a deleted entity returns 409 `entity_deleted`. The duplicate check (M2) still includes deleted entities: "A deleted record with this LEI exists. Ask the admin to reactivate it."
- No hard delete exists: no endpoint, no control (M16 AC14).

#### 4.8.2 Reactivation (M16 AC12, AC13, AC15, resolution 57)

- Admin only, from the deleted-record banner or Admin > Deleted records (columns: entity name, LEI, country, roles, deleted by, deleted at, reason; newest first; search by name or LEI).
- Confirmation "Reactivate <entity>? All its data returns to search and worklists."
- If another active entity now holds the same LEI, the dialog adds "<other entity> already uses this LEI. Both records will stay active." with that record's legal name, country, owner and "Open record", and requires a reason (10 to 500). Both records stay active; the reason goes to the audit entry and to a History event on the reactivated record.
- Effects: `deletedAt`, `deletedById` cleared (the original reason stays in the audit log). One audit entry: Record status Deleted → Active. History event (Network and structure).
- Everything returns exactly as before: owner, products, stages, blocks, contacts, pending handoffs (still Sent, back on both worklists), unacknowledged owner assignments. No new owner notification is created (M16 edge case 6).

#### 4.8.3 Mark as inactive (distinct from soft delete)

Ops sets Inactive on the Details tab (reason 10 to 500) and clears it with "Mark as active" (recompute, 4.3.6). Inactive entities stay readable and editable, appear in search only when the lifecycle filter includes Inactive (with an "Inactive" badge), and are excluded from worklists and the billing flag.

#### 4.8.4 Reset demo data (resolution 4, M16 AC16)

- Exists only when `DEMO_MODE=true`; otherwise the route returns 404 and no control renders. Admin only.
- Dialog "Reset all demo data? Every change made since the last reset is lost." Buttons "Reset demo data" (carmine) and "Cancel".
- Server: one transaction on the owner connection (`DATABASE_ADMIN_URL`): `TRUNCATE` every application table except `DemoMeta`, including `AuditEntry` and `HistoryEvent` (`RESTART IDENTITY CASCADE`), then run the seed with `demoDay = today()` in Europe/Amsterdam, so every seed date is recalculated as an offset from today. The seed's own historical audit entries (for example the KYB entries dated today-700 on Adyen) are inserted with their offset timestamps.
- After success the client navigates to Home and shows the toast "Demo data reset". The "View as" cookie is kept; other open sessions see the new data on their next request.
- This is the only path that removes audit entries, and it runs only on demo data. `npm run db:reset` performs the same seed from the command line.

---

#### Conflicts resolved

- M12 AC12 says Overdue is set for Planned or In progress reviews, and also that moving Overdue to In progress shows In progress with "Past due": followed the second rule for display (In progress + "Past due") and treat both as overdue for worklists and alerts.
- M15 AC3 lists roles inside the entity core row; S7.3 splits "Roles and lifecycle state" and adds "Create customer (wizard)": used the S7.3 granularity with identical rights (Sales sets roles only through the wizard).
- M1 AC14 lists 6 Overview alerts (resolution 41) while S4.1, M5 AC12, M6 AC13, M7 AC7, M12 AC15 and scenario decision 8 add more: the alert list is the union.
- Resolution 49 names coverage, role and group events for "Network and structure"; M10 AC5 also puts contract reference changes and "Record created" there: used the M10 AC5 superset.
- M7 AC3 original Partner-context wording vs resolution 48 / M15 AC4: every Partner-context role except Billing is owned by Network.
- M8 AC15 vs M15 AC3 on who cancels Ops → CS: any Ops user (resolution 33).
- S1 "Handoff declined" leaves "when the user sends a new handoff": applied as "when any newer Ops → CS handoff exists for the entity", since any Ops user can send one (resolution 38).

#### Assumptions where sources are silent (flag for the PM)

- Stale handoff threshold: highlighted when 2 or more business days have elapsed after `sentOn` (Mon-Fri dates after the sent date up to today); the "Waiting <n> days" number is calendar days. The seed example (sent 29 Sep, demo 02 Oct, "Waiting 3 days") fits both.
- Ops "My team" covers entities owned by any Ops user, with no owner, or with an accepted Ops → CS handoff. Entities still owned by Sales (pickup pending) show no Ops entity items until pickup. Seeded CS-owned entities with products need an Accepted Ops → CS handoff in the seed (as for MPS) so their Ops items stay visible.
- Recipient change on a Sales → Ops handoff is allowed to any Sales user (the matrix is team-level). Confirm pickup requires the recipient to still be in Ops.
- An owner change by handoff supersedes unacknowledged M9 items on that entity.
- A skip past Live & hypercare sets "Billable from" to the entry date of that move.
- Lifecycle state of a customer entity with no active product lines (all lines cancelled) is Onboarding unless Inactive. Partner-only entities follow decision B1 (4.3.6).
- Writes on a soft-deleted entity return 409 `entity_deleted` (the ACs give the copy; the status code is set here).
- The LEI KYB card shows Expired for an invalid GLEIF status even before Compliance records a verification, so the Compliance worklist lists the lapsed LEI from the seed.
- "Renewal within 30 days" alert also covers a passed renewal date ("Renewal date passed (<date>)").


### 4.9 Issue engine (M17 to M27)

**Release:** R1 in milestones 6A to 6C (Appendix B R1 ACs, 7.6.12); the R2 rules of 4.9.13 in milestone 12A. Not implemented until the PO says so (decision B15).

This section holds the server rules of the issue flow. Appendix B gives the copy and the examples; the worked examples there (demo day Monday 05 Oct 2026, CEST, BST, MYT, SGT) are unit-test cases for these rules (7.3.1).

#### 4.9.1 Code layout and the read-time rule

| File | Holds |
|---|---|
| `src/lib/business-hours.ts` | Calendars, `isInBusinessHours`, `nextBusinessStart`, `addBusinessMinutes`, `businessMinutesBetween` (4.9.3). Pure, shared by client and server |
| `src/lib/time-zones.ts` | `effectiveTimeZone(user)`, `formatInZone(instant, zone)` ("04 Oct 2026 21:12 CEST", "21:12 CEST"), `tzAbbreviation(instant, zone)` from `TZ_ABBREVIATIONS` (3.3.6) |
| `src/server/derived/severity.ts` | `proposeSeverity()` with the caps (4.9.4). Pure; the report form imports the same function for the live proposal |
| `src/server/derived/issue-clocks.ts` | `computeClocks(issue, ctx, now)` and `clockText()` (4.9.5). Pure |
| `src/server/derived/issue-steps.ts` | `stepsFor(issue, user, now)` (4.6.9) |
| `src/server/derived/communicator.ts` | `effectiveCommunicator(issue, entity, now)` (4.9.7) |
| `src/server/issues/routing.ts` | `routeIssue()` (4.9.2), `onCallAt(team, instant)`, `issueTeamMember(entity, team)` |
| `src/server/issues/system-writes.ts` | `ensureSystemWrites(issueIds, now)`: the idempotent on-read writes (4.9.7) |
| `src/server/issues/partner.ts` | `affectedCustomers()`, linked-issue creation, attach, unlink, cascade (4.9.8) |
| `src/server/issues/compliance.ts` | `evaluateComplianceFlag()`, assessor choice (4.9.9) |
| `src/server/issues/message.ts` | Template subject and body, `gmailComposeUrl()` (4.9.10) |
| `src/server/services/issue*.ts` | Every issue write, through `mutate()` (4.2.1) |

**Read-time rule (decision B36).** There is no scheduled job. Every time-based state (queued issue becomes visible, clock running, due now, overdue, hand-over passed, update due, automatic close due in R2) is a function of stored instants and `now()` from `src/lib/dates.ts`, so the demo clock (`DEMO_CLOCK_START`) drives it in tests. The rules never depend on a write happening on time: `effectiveCommunicator()` and `stepsFor()` give the right answer from the stored instants alone. The idempotent system writes of 4.9.7 only add the log entry, note, audit entry and History event that record the moment.

#### 4.9.2 Routing (rules 1 to 8, M18)

`routeIssue(input, t)` runs inside the report transaction at save time `t` (and again on a type change at the change time, M19 AC17). The form sends no owner, communicator or contributor (decision B16).

```ts
export function routeIssue(i: RoutingInput, t: Date): Routing {
  // Rule 7: a linked issue created from a partner issue inherits the parent's owner and needs no acknowledgement
  if (i.parent) return { ownerTeam: i.parent.ownerTeam, ownerId: i.parent.ownerId, rule: 'INHERITED_FROM_PARENT',
                         clocksStartAt: t, ack: false, ...communicatorFor(i, i.parent.ownerId, t) };

  const ownerTeam = ISSUE_TYPE_ROUTING[i.type].owner;                         // rule 1
  const named = issueTeamMember(i.entity, ownerTeam);                          // SALES: creator, else Tom Hadley if inactive
  const cal = teamCalendar(ownerTeam, named);                                  // SALES: the named person's time zone
  let ownerId: string | null, rule: RoutingRule, clocksStartAt = t;

  if (isInBusinessHours(t, cal)) {                                              // rule 2
    ownerId = named?.id ?? onCallAt(ownerTeam, t)?.id ?? null;
    rule = named ? 'NAMED_PERSON' : 'ON_CALL_IN_HOURS';
  } else if (i.severity === 'SEV1') {                                           // rule 3
    if (ON_CALL_TEAMS.includes(ownerTeam)) { ownerId = onCallAt(ownerTeam, t)?.id ?? null; rule = 'ON_CALL_OUT_OF_HOURS'; }
    else { ownerId = onCallAt('COMPLIANCE', t)?.id ?? null; rule = 'COMPLIANCE_ON_CALL'; } // Sales and Finance have no on-call; `named` joins as contributor
  } else {                                                                      // rule 4
    ownerId = named?.id ?? null;                                                // null: set at clock start (4.9.7)
    rule = 'QUEUED_FOR_BUSINESS_HOURS';
    clocksStartAt = nextBusinessStart(t, cal);
  }
  if (!ownerId && rule !== 'QUEUED_FOR_BUSINESS_HOURS') throw new RoutingError(); // M18 error state
  return { ownerTeam, ownerId, rule, clocksStartAt, ack: true, ...communicatorFor(i, ownerId, t) };
}

function communicatorFor(i: RoutingInput, ownerId: string | null, t: Date) {
  if (i.isPartnerIssue) return { communicatorRule: 'ISSUE_OWNER_PARTNER', handoverAt: null };       // rule 7
  const co = i.entity.owner;                                                                         // customer owner (M9)
  if (i.severity === 'SEV1' && co && co.id !== ownerId && !isInBusinessHours(t, userCalendar(co)))   // rules 3 and 3b
    return { communicatorRule: 'ISSUE_OWNER_UNTIL_HANDOVER', handoverAt: nextBusinessStart(t, userCalendar(co)) };
  return { communicatorRule: 'CUSTOMER_OWNER', handoverAt: null };                                   // M18 AC7
}
```

Rules in words, with their edge cases:

| # | Rule | Detail |
|---|---|---|
| 1 | Owner team from the type | `ISSUE_TYPE_ROUTING` (3.3.6) |
| 2 | Inside the owner team's hours | The entity's named person in that team (`IssueTeamMember`); with none, the team's on-call person, "No named <Team> person on this entity: routed to on-call" (M18 AC4) |
| 3 | Outside hours, Sev-1 | The owner team's on-call person (`OnCallShift` covering `t`). Ownership stays with that person after the hand-over and after the rota changes (M21 edge case 6) |
| 3b | Sev-1 while the customer owner is outside their own hours | The issue owner communicates until `handoverAt` = the customer owner's next business start. When the customer owner is the owner (Zopa Bank Limited, Kevin Lim) there is no hand-over (M18 edge case 3). When the customer owner is already in hours, the customer owner communicates from the start |
| 4 | Outside hours, Sev-2 to Sev-4 | Owner = the named person, set at save; `clocksStartAt` = the owner team's next business start; the issue reaches the owner's and the communicator's main list then; the communicator can record a notification earlier (M18 AC6, M19 AC7). With no named person, the owner is the on-call person on duty at `clocksStartAt` (4.9.7) and the confirmation reads "Owner: assigned at the start of <Team> business hours" |
| 5 | Default contributor | The entity's named person in the contributor team of the type; never the on-call person; skipped when that person is the owner. None named: "No default contributor: no named <Team> person on this entity" (M18 AC8) |
| 6 | Absence and backup | R2 (4.9.13) |
| 7 | Partner issues | Communicator towards the partner = the issue owner (Network), Lloyds Bank plc included. Linked customer issues: see 4.9.8 |
| 8 | Group report | One issue per ticked entity, each routed on its own, all in one transaction, sharing one `IssueGroupReport` |

Boundaries: 09:00:00 owner time is inside, 18:00:00 is outside (M18 edge case 1). A severity change never reruns routing (M18 edge case 5); a type change does (M19 AC17). The Sales owner team uses the named Sales person's own time zone (Revolut Ltd: Michael Reed, America/New_York, M18 edge case 4). A Sev-1 of a Finance or Sales type (only possible with a possible data breach, B25, B26) outside hours goes to the Compliance on-call person as owner with `COMPLIANCE_ON_CALL`; the type stays unchanged, the owner communicates until the customer owner's business hours start (rule 3, `communicatorFor()`), and the entity's named Finance or Sales person is added as contributor next to the type's default contributor. This is the PM decision of 5 October 2026 (B19).

`routingReason` stores the "Why this owner" line (labels in 3.3.5) at routing time. "Copy for the customer" copies "<ID> is with our <Team> team (<owner>). <communicator> will keep you updated." (M18 AC9).

#### 4.9.3 Business-hours arithmetic (per team and per user)

```ts
// src/lib/business-hours.ts
export type Calendar = { timeZone: string; start: string; end: string; weekdays: number[] }; // "09:00", "18:00", [1..5]

export function teamCalendar(team: Team, person?: { timeZone: string; team: Team } | null): Calendar;
//   OPS, NETWORK, COMPLIANCE, FINANCE: the TeamBusinessHours row (team time zone).
//   SALES, CS: the row's hours in the person's own time zone (owner team Sales: the named Sales person).
export const userCalendar = (u: { timeZone: string; team: Team }) => teamCalendar(u.team, u);
export const effectiveTimeZone = (u: { timeZone: string; team: Team }) => TEAM_TIME_ZONES[u.team] ?? u.timeZone;

// One window per local calendar date, converted on that date: DST changes need no special case.
function windowOn(localDate: LocalDate, cal: Calendar) {
  return { start: zonedInstant(localDate, cal.start, cal.timeZone), end: zonedInstant(localDate, cal.end, cal.timeZone) };
}
export function isInBusinessHours(t: Date, cal: Calendar): boolean {
  const d = localDateIn(t, cal.timeZone);
  if (!cal.weekdays.includes(isoWeekday(d))) return false;
  const w = windowOn(d, cal);
  return t >= w.start && t < w.end;                                  // 09:00:00 inside, 18:00:00 outside
}
export function nextBusinessStart(t: Date, cal: Calendar): Date {     // t itself when inside
  if (isInBusinessHours(t, cal)) return t;
  for (let d = localDateIn(t, cal.timeZone), i = 0; i < 8; d = addDays(d, 1), i++) {
    if (!cal.weekdays.includes(isoWeekday(d))) continue;
    const w = windowOn(d, cal);
    if (w.start > t) return w.start;
  }
  throw new Error('calendar has no business day');
}
export function addBusinessMinutes(t: Date, minutes: number, cal: Calendar): Date {
  let cur = nextBusinessStart(t, cal), left = minutes;
  for (;;) {
    const w = windowOn(localDateIn(cur, cal.timeZone), cal);
    const room = (w.end.getTime() - cur.getTime()) / 60_000;
    if (left <= room) return new Date(cur.getTime() + left * 60_000);   // may end exactly at 18:00
    left -= room;
    cur = nextBusinessStart(w.end, cal);
  }
}
```

- Use `date-fns` v4 with `@date-fns/tz` (`TZDate`) for `zonedInstant` and `localDateIn`. All stored instants are UTC.
- Business hours: Monday to Friday, 09:00 to 18:00 local, no holiday calendar (B17). 1 business day = 540 business minutes (B30).
- Whose calendar counts: acknowledge targets of Sev-3 and Sev-4 use the owner team's calendar (owner team Sales: the named Sales person's zone); the Sev-2 notification target uses the communicator's calendar; the hand-over uses the customer owner's calendar; the Compliance assessor's visibility uses the Compliance calendar; R2 "Remind customer", automatic closes and the reopen window count in the communicator's calendar.
- Ops, Network, Compliance and Finance users always use their team's zone (`effectiveTimeZone`), whatever `User.timeZone` holds. Sales and Customer Success users use `User.timeZone`.
- Checked examples (unit tests): Friday 09 Oct 2026 16:30 SGT + 540 = Monday 12 Oct 16:30 SGT (M19 AC8); Wednesday 07 Oct 11:00 MYT + 1,620 = Monday 12 Oct 11:00 MYT; Saturday 11:00 SGT + 540 = Monday 18:00 SGT (M19 edge case 9); Monday 05 Oct 10:00 CEST (16:00 MYT) + 240 in Asia/Kuala_Lumpur = Tuesday 11:00 MYT, 05:00 CEST (M19 AC14).

#### 4.9.4 Severity proposal and caps

```ts
// src/server/derived/severity.ts (also imported by the report form)
export function proposeSeverity(i: { impact: IssueImpact; possibleBreach: boolean; type: IssueType;
                                    decidingStage: Stage | null; customerRole: boolean; scheme?: Scheme; country?: string }) {
  if (i.possibleBreach) return { severity: 'SEV1', rule: 'Possible data breach', capLabel: null };        // B25: overrides every cap
  let s = SEVERITY_FROM_IMPACT[i.impact], capLabel: string | null = null;
  if (TYPE_SEVERITY_CAP[i.type] && rank(s) < rank('SEV2')) { s = 'SEV2'; capLabel = 'Highest severity for this type: Sev-2'; }
  const preGoLive = i.customerRole && (i.decidingStage === null || stageNumber(i.decidingStage) < 7); // 3.3.1: 7 = Live & hypercare
  if (preGoLive && rank(s) < rank('SEV3')) { s = 'SEV3'; capLabel = preGoLiveLabel(i); }
  return { severity: s, rule: IMPACT_LABEL[i.impact], capLabel };
}
```

- Deciding stage (M17 AC8, M19 AC3): the selected product line's stage; with no product line, the most advanced stage among the entity's non-cancelled lines on the selected scheme and country; with no scheme (optional types), the most advanced among all its lines. A customer entity with no line on that scheme and country is capped, label "Sev-3 maximum before go-live: no live product on <scheme> / <country>". Partner-only entities (no active Customer role) are never capped: the cap reads customer product lines only (M17 edge case 1).
- Labels: form "Proposed severity: Sev-2 (Degraded)", "Proposed severity: Sev-1 (Possible data breach)", "Capped at Sev-3: <product> / <country> is at <stage>, before go-live. No customer notification clock starts.", "Highest severity for this type: Sev-2". Issue badge "Sev-3 maximum before go-live: EU VoP / DE is at UAT" (stored in `severityCapLabel`).
- The server recomputes the proposal at save; the stored `severity` equals `proposedSeverity` at creation, and only the owner changes it afterwards (M19 AC1, AC13).
- `notifyRequired` = severity Sev-1 or Sev-2 and no pre-go-live cap in force (a possible breach lifts the cap, so a breach before go-live gets the full rules, M19 AC2).
- "Add to existing issue" never changes the target's severity; when the added report's own proposal is higher, the note shows "Reported impact suggests Sev-1" (M17 AC6).

#### 4.9.5 Clocks computed on read

Each clock stores its start and its due time when it starts or is recalculated; its state and text are computed on every read by `computeClocks()`.

| Clock | Start (stored) | Due (stored) | Stop | R |
|---|---|---|---|---|
| Acknowledge | `ackStartAt` = `clocksStartAt` (save, or rule 4 start); none on CREATED linked issues | Sev-1 +15 min, Sev-2 +60 min elapsed; Sev-3 +540, Sev-4 +1,620 business minutes of the owner team | "Acknowledge" (`acknowledgedAt`) | R1 |
| Customer notification | `notifyStartAt` = `awareAt`, or `clocksStartAt` under rule 4 | Sev-1: + card "Incident notification time" (read now into `notifyTargetHours`), or +2 h with `notifyDefaultTarget`; Sev-2: +240 business minutes of the communicator | First notification recorded (`notifiedAt`) | R1 |
| Compliance assessment | `complianceClockStartAt` (flag set while Sev-1) | +60 min, shown while the issue is Sev-1 | Any assessment | R1 |
| Update | Each notification or update | +120 min (Sev-1), +480 min (Sev-2), current severity | Next update; Resolved | R2 |
| Facts for the customer's regulator | "Possible major incident" recorded | + card "Facts needed within (hours)"; none: "Facts deadline not captured" in red | "Facts pack sent" | R2 |
| Data breach notification | "Possible data breach" recorded | +24 h, rule label from the Corvane entity | "Breach notification" | R2 |

States: `queued` (now < `clocksStartAt`: no countdown, "Clocks start <date time in the viewer's zone>, the start of <Team> business hours"), `running`, `due_now`, `overdue`, `stopped_on_time`, `stopped_late`, `not_required` ("Customer notification: not required before go-live", "Customer notification: no deadline at Sev-3"). A first notification recorded before `notifyStartAt` gives "Notified before the clock started" (M19 AC7). Resolved issues show "No active clocks" when nothing runs.

```ts
// src/server/derived/issue-clocks.ts
export function clockText(verb: 'Acknowledge' | 'Notify customer' | 'Send update' | 'Assess' | 'Send facts pack' | 'Notify data breach',
                          due: Date, now: Date, viewerZone: string): { text: string; overdue: boolean } {
  const ms = due.getTime() - now.getTime();
  if (ms <= 0 && ms > -60_000) return { text: verb === 'Send update' ? 'Update due now' : `${verb} now`, overdue: false }; // due minute
  if (ms <= -60_000) return { text: `Overdue by ${duration(Math.floor(-ms / 60_000))}`, overdue: true };                  // red
  const min = Math.ceil(ms / 60_000);                                       // "in 0 min" never appears
  if (min < 60) return { text: `${verb} in ${min} min`, overdue: false };
  if (min < 24 * 60) return { text: `${verb} in ${duration(min)}`, overdue: false };                                     // "1h 20m", "2h"
  return { text: `${verb} by ${formatInZone(due, viewerZone)}`, overdue: false };                                         // "12 Oct 2026 16:30 SGT"
}
// duration(): under 60 "25 min"; under 24 h "1h 25m" ("2h" when the minutes are 0); from 24 h "2 days"
```

- Results of stopped clocks: "Acknowledged 9 min after report (target 15 min)", "Acknowledged 3 min late" (red), "Notified 53 min after Corvane aware at (target 6h)", "Assessed 46 min after the flag (target 1h)". Targets read "15 min", "1h", "6h", "4 business hours", "1 business day", "3 business days".
- The header shows the running clock with the earliest due time ("one visible deadline", M19 AC12); the Clocks panel lists every clock, stopped ones with their result.
- Times display in the viewer's effective time zone with the `TZ_ABBREVIATIONS` abbreviation: Emma Wilson sees "21:12 CEST", Kevin Lim "03:12 MYT" for the same instant (M19 AC6).
- Texts refresh at least every 60 seconds in the browser from `serverNow` (4.6.9).
- US alert (Appendix B conventions): on an issue at a customer with regime United States, impact Down, status before Resolved and `now - awareAt` of 4 hours or more, the page shows "Interruption ≥4h at a US-regulated customer: notify immediately". It is no deadline and creates no step.

#### 4.9.6 Recalculation on severity and type change

| Change | Rule | AC |
|---|---|---|
| Severity up | Notification not yet recorded: `notifyRequired` recomputed; the target is recalculated from `awareAt` (Sev-1 reads the card value at this moment); a due time already past shows "Overdue by ..." at once. Notification already recorded: the clock stays stopped, `severityRaisedAfterNotice = true` and the page shows "Severity raised after notification. Tell the customer in the next update". Acknowledge not yet done: new target from the original `ackStartAt`. The Compliance flag is re-evaluated (4.9.9). Routing is not rerun | M19 AC14, edge case 1, M18 edge case 5 |
| Severity down (R1) | Change and reason saved; every started clock keeps its target and due time | M19 AC15 |
| Severity down (R2) | Before notification the notification clock keeps its original due time until a notification is recorded; an unacknowledged acknowledge clock takes the new target from `ackStartAt`; the update cadence follows the new severity | M19 AC16 |
| Type | New owner team; routing rules 2 to 4 rerun at the change time (4.9.2), communicator rule included; status New, `acknowledgedAt` cleared, acknowledge clock restarts at the change time (or the next business start under rule 4) with the current severity; the notification clock keeps its start and target; the new type's default contributor is added and existing contributors stay; a capped type with Sev-1 and no breach becomes Sev-2 with the type reason; the previous owner keeps read access and notes; CREATED children follow the new owner | M19 AC17, AC18, M23 AC17 |
| Stage or card later | Nothing changes on open issues: a product going live removes the cap label and lets the owner raise severity; a card edit applies to clocks started after it | M19 edge cases 4 to 6 |

The change dialogs disable options per 3.4.3 and the server refuses them with the same copy.

#### 4.9.7 Communicator, hand-over and other on-read system writes

```ts
// src/server/derived/communicator.ts
export function effectiveCommunicator(issue: IssueRow, entity: { ownerId: string | null }, now: Date): string | null {
  switch (issue.communicatorRule) {
    case 'ISSUE_OWNER_PARTNER':        return issue.ownerId;                                   // moves with the owner (M21 AC9)
    case 'ISSUE_OWNER_UNTIL_HANDOVER': return now < issue.handoverAt! ? issue.ownerId : entity.ownerId;
    case 'TAKEN_OVER':                 return issue.takenOverById;                             // R2
    default:                           return entity.ownerId;                                  // null: "No communicator: set an owner on the entity"
  }
}
```

- The header during the interim period reads "Communicator: Kevin Lim (on-call) until 09:00 CEST, then Emma Wilson" (rule 3) or "Communicator: <owner> (issue owner) until 09:00 BST, then Sophie Mitchell" (rule 3b), times in the viewer's zone.
- **Customer owner changes (M18 AC7, M22 AC1).** The customer communicator is read from `Entity.ownerId`, so it changes at once. The services that change the owner call `onCustomerOwnerChanged(tx, entityId, oldOwner, newOwner, actor)` in their transaction: M9 reassign (exists from milestone 5; 6B adds the call), Sales → Ops Confirm pickup and Ops → CS Accept (milestone 7 adds the call). For every open customer issue on the entity whose communicator follows the customer owner at that moment, it writes the system log entry and note "Communicator changed to <new owner>: customer owner changed", one audit entry (field "Communicator") and one History event. Issues still in their interim period get no entry; their hand-over goes to the new owner.
- **Hand-over (B20, M22 AC10).** `ensureSystemWrites()` runs at the start of `GET /api/issues/{issueId}`, of `GET /api/worklist/issues` (for the issues it returns) and of every issue write. For each issue with `communicatorRule = ISSUE_OWNER_UNTIL_HANDOVER`, `handoverAt <= now` and `handoverWrittenAt = null`, one short transaction:
  1. `INSERT` the `IssueCommunication` (type `SYSTEM`, `occurredAt = handoverAt`, `systemKey = "handover:<issueId>"`); on a unique violation another request already wrote it, so roll back and continue.
  2. `INSERT` the matching `IssueNote` (kind `SYSTEM`), set `handoverWrittenAt = now`.
  3. One audit entry (source `SYSTEM_ISSUE`, field "Communicator", old = the issue owner, new = the customer owner) and one History event "ISS-1042: communication handed over to Emma Wilson at 09:00 CEST".
  Text: "Communication handed over to <customer owner> at <handoverAt>. Already communicated: <entries>. Owner: <issue owner>." where `<entries>` lists every First notification and Update before `handoverAt` as "<type> by <channel> to <person> at <time> by <recorder>", joined with "; ". With none: "nothing yet." plus "Notify customer was due <notifyDueAt>." when that clock ran. Times in the customer owner's zone, written once into the text.
- **Queued issue with no named person (M18 AC6).** At `clocksStartAt`, `ownerId = null` is filled with the on-call person on duty at that instant by a conditional update (`WHERE "ownerId" IS NULL`), plus its audit entry and History event. In the seed every team has a named person, so this path is covered by unit tests only.
- **R2 automatic closes (M21 AC14, M22 AC20)** use the same pattern, with `systemKey = "autoclose:<issueId>"`.
- A write by a user who stopped being the communicator at `handoverAt` returns 403 `communication_handed_over` with "Communication passed to Emma Wilson at 09:00 CEST. Ask her to record this, or add it as a note." (M22 edge case 4).

#### 4.9.8 Partner issue: affected customers, fan-out and cascade (M23)

- **Partner issue.** Type `PARTNER_DEGRADED` on an entity with an active Partner role, scheme and country matching a non-Retired coverage row (M23 AC1). Owner team Network, default contributor the entity's named Ops person, communicator the owner (rule 7). It reads no customer card: no notification clock and no Compliance flag from a regime; the page shows the Partner agreement value as information, "Partner agreement incident notification time: 1 h" (Lloyds Bank plc). The incident contact and the template use the Partner-context primary incident contact (Paul Grant).
- **Degraded proposal (M23 AC4).** Computed on read: while the partner issue is not Resolved and the coverage row's current status is Active or Onboarding, Network users see "Coverage <scheme> / <country> is <status>. Set it to Degraded?" with "Set to Degraded", which opens the existing M5 Change status dialog prefilled (Degraded, today, reason "<ID>: <description>" cut to 500). Other teams see "Coverage change proposed to Network". After a Degraded change on that row since the issue's creation: "Coverage <scheme> / <country> set to Degraded by <user> at <time>". Already Degraded or Suspended: "Coverage <scheme> / <country> is Degraded since <date>". "Not now" hides the button for the browser session (`sessionStorage`, wrapped in try/catch).
- **Affected customers (M23 AC5, AC6, AC13), computed on read.** Entities with an active Customer role, lifecycle not Inactive, not soft-deleted, and a non-cancelled product line on the issue's scheme and country. Line at Live & hypercare, Ramp-up or BAU: "Affected customers"; line before Live & hypercare: the collapsed group "Not affected: before go-live (<n>)". The partner entity itself is included when it qualifies. One row per entity (two lines on one entity share the row). Columns: entity, product line, stage, communicator (`effectiveCommunicator` for a customer issue at that moment), Incident notification time, "Notify by" (Sev-1: `awareAt` + card hours, or + 2 h with the default label; Sev-2: + 240 business minutes of that row's communicator), linked issue (ID and status, or "None"). Sorted by "Notify by", earliest first.
- **Create linked issues (M23 AC7 to AC9).** Owner of the partner issue only. One transaction for every ticked row, all or none ("Linked issues not created. Nothing was saved. Try again."). Rows are processed in dialog order, so issue numbers follow "Notify by". Per row:
  - "Create a new linked issue": a new `Issue` on the customer with the affected line, the parent's scheme, country, type, severity, `awareAt`, impact and possible breach answer; description "Linked to <parent ID>: <partner> <scheme> / <country> partner issue." plus the parent's description; reporter = the clicking user; owner = the parent's owner, `routingRule = INHERITED_FROM_PARENT`, "Why this owner: inherited from partner issue <ID>"; no acknowledge clock; status In progress when the parent is acknowledged, otherwise New; communicator per `communicatorFor()` (rules 3 and 3b apply to the customer owner); notification clock from `awareAt` with that customer's card; default contributor = the customer's named Ops person; Compliance flag evaluated with that customer's card. `IssueLink` kind `CREATED`.
  - "Attach ISS-<id>": an `IssueLink` kind `ATTACHED` to an open issue on the same entity, scheme and country; nothing else on that issue changes. Default "Attach" for types Service unavailable or latency and Partner degraded or unavailable, otherwise "Create a new linked issue".
  - Dual-role entity (Lloyds Bank plc): the linked issue sits on the customer role; banner "This entity is also the affected partner" with "Open <parent ID>" and the latest partner-issue communication ("Network last contacted the partner at 10:12 CEST: Paul Grant, phone", or "Network has not contacted the partner yet"); recipient the Customer-context incident contact (Ruth Okafor); deadline from the Customer agreement card.
- **Owner sync (M23 AC17).** Acknowledge on the parent moves CREATED children in New to In progress. Reassign or type change on the parent sets the same owner on every active CREATED child in the same transaction, one audit entry per issue. CREATED children have no "Reassign issue"; ATTACHED children keep their owner.
- **Linked issues panel (M23 AC10).** Every active link with ID, entity, communicator, status and the communicator's current clock; header "Customers notified <n> of <m>". A child on a soft-deleted entity counts as "1 linked issue on a deleted record" with no link.
- **Cascade (M23 AC11, AC12).** Resolving the parent asks "Resolve <ID> and <n> linked issues?" (n = active links in New, In progress or the two Waiting statuses). In one transaction each such child gets status Resolved, a copy of the root cause and solution (`cascadedFromIssueId`), and the system note "Resolved with partner issue <ID> by <user> (<team>)". Children already Resolved or Closed stay. A running notification clock keeps running. Each communicator closes their own issue; closing the parent closes only the parent.
- **Unlink (M23 AC14).** Owner of the parent, reason 5 to 500. The child stays open with its communicator and the owner it has at that moment, loses "Linked to", leaves the cascade, and its customer returns to "Affected customers" with "None".
- **Severity raised on the parent (M23 edge case 2).** Children keep their severity; the dialog after the change shows "<n> linked issues are Sev-2. Review their severity." with links.

#### 4.9.9 Compliance flag and assessment (M25, M26)

```ts
// src/server/issues/compliance.ts: on save, on every severity change and on every type change
export function complianceReasons(issue: IssueRow, card: CustomerAgreement | null, isPartnerIssue: boolean): string[] {
  const r: string[] = [];
  if (issue.possibleBreach || issue.type === 'DATA_BREACH_SECURITY') r.push('possible data breach reported');
  if (!isPartnerIssue && issue.severity === 'SEV1') {
    const regime = card?.regulatoryRegime ?? null;
    if (regime === null) r.push('Sev-1, regulatory regime not captured');
    else if (regime !== 'NONE') r.push(`Sev-1 at a regulated customer (${regimeLabel(card!)})`);
  }
  return r;                                            // shown as "Flagged for Compliance: <reason>"
}
```

- The first non-empty result sets `complianceFlaggedAt`; later evaluations add reasons and never remove the flag (M25 edge cases 1, 3). `complianceClockStartAt` is set the first time the flagged issue is Sev-1 with no assessment; the 1-hour countdown shows only while the issue is Sev-1, otherwise "Assessment pending" (M25 AC5, edge cases 1, 2).
- Assessor (M25 AC4): inside Compliance hours the entity's named Compliance person; outside them on Sev-1 the Compliance on-call person; outside them below Sev-1 the named person, visible from the next Compliance business start (`complianceVisibleFrom`, M25 edge case 6). The owner and the communicator do not change.
- Regime None with no breach: not flagged; a Sev-1 shows "Not flagged: customer recorded as not regulated". No regime or no card: "Complete the Customer agreement card: regulatory regime not captured" with a link to the Compliance tab (M25 AC3).
- Assessment (M25 AC6 to AC8): any Compliance user, three outcomes, rationale 10 to 1,000; stops the assessment clock; "Neither" sets `complianceClosedAt` with "Assessed: neither. No regulatory clock started."; a new assessment is allowed while the issue is not Closed; the block lists every assessment, newest first.
- The read-only "Customer obligations" block on every customer issue (M26 AC8): "Incident notification time <n> h · <regime> · Facts needed within <n> h", "Not captured" for empty values; R2 adds "Post-incident report due".

#### 4.9.10 Message template and Gmail compose URL (M22 AC3 to AC5)

- Built by `src/server/issues/message.ts` for the current communicator; the preview is read-only for everyone else.
- Subject: "[Corvane] <Severity> incident <ID>: <product> <scheme> <country>". The product of a line is its scheme in this data model, so the value shows once: "[Corvane] Sev-1 incident ISS-1042: EU VoP IT". With no scheme and country the subject ends after the ID.
- Body, in this order: "Dear <incident contact>," (no contact: "Dear <entity> team,"), blank line, "We are informing you of an incident affecting <entity>.", blank line, "Affected service: <scheme>, <country>" (none: the type label), "Corvane aware at: <date time>", "Impact: <impact>", "Current status: <status>", "Next update by: <preparation time + UPDATE_INTERVAL_MINUTES of the severity, rounded up to the next 5 minutes>" (Sev-3 and Sev-4: "Next update: when the status changes"), "Issue ID: <ID>", blank line, "Please quote <ID> in any reply.", blank line, "Kind regards,", the communicator's name, "Corvane". Times in the incident contact's time zone with its abbreviation (3.3.6).
- Recipient: the primary active Incident contact of the issue's role context (Customer for customer issues, Partner for partner issues, M7 AC9); none: empty recipient, the hint "Add the recipient in Gmail" and the carmine "No active incident contact".
- The communicator can edit subject and body in place; edits stay in the page until a notification is recorded.
- "Copy message": subject, a blank line, then the body, as plain text; toast "Message copied".
- "Open in Gmail":

```ts
export function gmailComposeUrl(to: string | null, subject: string, body: string): string {
  const q = encodeURIComponent;                     // "@" → %40, space → %20, new line → %0A
  return `${GMAIL_COMPOSE_URL}&to=${q(to ?? '')}&su=${q(subject)}&body=${q(body)}`;
}
// https://mail.google.com/mail/?view=cm&fs=1&to=silvia.moretti%40mps.example&su=%5BCorvane%5D%20Sev-1%20incident%20ISS-1042%3A%20EU%20VoP%20IT&body=Dear%20Silvia%20Moretti%2C%0A%0AWe%20are%20...
```

  The client calls `const w = window.open(url, '_blank'); if (w) w.opener = null;`. A null `w` means the browser blocked the tab: show "Your browser blocked the Gmail window. Use Copy message" (M22 edge case 9). After the click the page shows "Sent it? Record the notification" next to "Record notification". Customer Hub sends nothing and writes nothing for these two buttons (M22 AC19).

#### 4.9.11 Audit and History for every issue write

Every write goes through `mutate()` (4.2.1): data, audit entries and the History event in one transaction; a failure writes nothing.

| Write | Audit (object "Issue: ISS-<n>") | History (`INCIDENT`, on the issue's entity) |
|---|---|---|
| Report | One entry per field set (old "(none)"), plus "Routing" with owner, communicator, contributors, rule and time | "Issue ISS-1043 reported by Emma Wilson (Customer Success): Sev-3, Wrong match result, UK CoP GB"; "ISS-1043 routed to Kevin Lim (Ops), communicator Adrian Koh (Ops)" |
| Add to existing issue | "Added report" on the target | "Report added to ISS-1038 by Emma Wilson (Customer Success)" |
| Description edit | Old and new | none |
| Acknowledge, status, resolve, back to work | Status, Acknowledged, Root cause, Solution, reason | "ISS-1042 acknowledged by Kevin Lim"; "ISS-1042 resolved by Kevin Lim. Root cause: <first 80 characters>..." |
| Severity, type | Field, old, new, reason | "ISS-1042 severity changed from Sev-2 to Sev-1 by Kevin Lim: <reason>" |
| Clock outcome | Clock, result (stopped on time, stopped late, overdue), written by the write that stops it; "overdue" is written by the first system write after the due time | "ISS-1042: acknowledged 3 min late" |
| Contributor, reassign | Contributor added or removed; Owner old, new, reason | "Lukas Brenner added as contributor to ISS-1038"; "ISS-1042 reassigned from Kevin Lim to Adrian Koh: <reason>" |
| Note | Note body | "Note added to ISS-1042 by Lukas Brenner" |
| Communication, close | Type, time, channel, person, message | "ISS-1042: First notification to Silvia Moretti by Email, recorded by Kevin Lim"; "ISS-1031 closed by Emma Wilson: closure confirmed by Claudia Schulz (Email)" |
| Communicator change, hand-over | Communicator old, new (source `SYSTEM_ISSUE` for the hand-over) | "ISS-1038: communicator changed to Emma Wilson (customer owner changed)"; "ISS-1042: communication handed over to Emma Wilson at 09:00 CEST" |
| Compliance | Flag reasons; assessment outcome and rationale | "ISS-1052 flagged for Compliance: Sev-1 at a regulated customer (UK FCA)"; "Compliance assessment: Possible major incident. By Mei Chen, Compliance." |
| Linked issues | Link created, attached, unlinked (reason); cascade resolution per issue | On both entities: "Linked issue ISS-1052 created from partner issue ISS-1050 (Lloyds Bank plc, UK CoP / GB). By Lukas Brenner, Network." |

Regulatory block edits use the existing obligations audit (object "Obligations", one entry per field, M26 AC6). "Copy message", "Open in Gmail" and "Copy for the customer" write nothing. Reads write nothing except the system writes of 4.9.7.

#### 4.9.12 Permissions and 403 rules

```ts
// src/server/issues/roles.ts
export function issueRoles(user: SessionUser, issue: IssueRow, entity: EntityRow, now: Date) {
  return {
    owner:        issue.ownerId === user.id,
    communicator: effectiveCommunicator(issue, entity, now) === user.id,
    reporter:     issue.reporterId === user.id,
    contributor:  issue.activeContributorIds.includes(user.id),
    compliance:   user.team === 'Compliance',
  };
}
```

| Action | Allowed | Else |
|---|---|---|
| Read the Issue page, add a note, report, "Add to existing issue" | Every active user of the 6 teams (matrix row 31) | Soft-deleted entity: deleted-entity response (4.1.5) |
| Edit description | Reporter while status New | 403 `not_reporter` |
| Acknowledge, change status, resolve, change severity, change type, add or remove contributors, reassign, create, attach or unlink linked issues, resolve with cascade, R2 root cause report | Owner (matrix row 32). On a partner issue, the linked-issue actions are the parent owner's | 403 `not_issue_owner`, message "Only the owner, <name>, can change this issue" (M21 AC11). After a type change moved the issue: 403 `issue_type_changed`, "This issue now belongs to <Team>. Reload." (M21 edge case 5) |
| Reassign a CREATED linked issue | Nobody: it follows the parent | 403 `linked_follows_parent` |
| Record notification or update, close, R2 reopen | Effective communicator at request time (matrix row 33) | 403 `not_communicator`; after the hand-over 403 `communication_handed_over` with the M22 edge case 4 copy |
| R2 take over communication | Customer Success user, communicator absent, customer issue | 403 `forbidden` |
| Record Compliance assessment | Any Compliance user (matrix row 34) | 403 `{"error":"forbidden","owner_team":"Compliance"}` |
| Regulatory block | Compliance (row 20) | 403 as M13 |

- `can()` evaluates the matrix row first, then the role predicate in its `check` (4.1.3), and runs again inside the transaction after re-reading the issue, so a role that changed in between is caught. A 403 writes nothing, not even an audit entry (M15 AC9).
- 403 body: `{"error":"forbidden","code":"<code>","message":"<copy>"}`. The UI shows the message as a toast and re-renders the page read-only.
- The UI renders owner controls only for the owner, communicator controls only for the communicator, "Record assessment" only for Compliance; every other user sees the same data read-only with "Add note" (M21 AC11, M22 AC18, M25 AC6).
- Admin: no extra issue rights (4.1.1).

#### 4.9.13 R2 rules (milestone 12A)

| Rule | Detail | AC |
|---|---|---|
| Absence and backup | `User.absentUntil` in the future: routing skips the named person and takes `IssueTeamMember.backupUserId`, else the team's on-call person; "Why this owner" reads "<Name> is absent until <date>: routed to <backup>". The admin sets "Absent until" on Users & roles (an assumption: Appendix B names no screen; record it in `DECISIONS.md`) | M18 AC12 |
| Severity down | 4.9.6 R2 row | M19 AC16 |
| Facts and breach clocks | Start on the assessment; facts target read once from "Facts needed within (hours)"; breach label from `BREACH_RULE_BY_CORVANE_ENTITY` of the billing profile's Corvane entity, or of the invoiced entity when billed through another; stopped by "Facts pack sent" and "Breach notification" | M19 AC10, AC11, M25 AC9, AC10, M22 AC13 |
| Update cadence | Update clock after each notification or update; "Send update in 1h 15m", "Update due now", "Overdue by 25 min"; stops at Resolved | M22 AC14, M20 AC14 |
| Remind customer, automatic closes | Counted in the communicator's business days from `waitingOnCustomerSince` or `resolvedAt`; closes written by the on-read system writes (4.9.7) with actor "Customer Hub (automatic)" and the AC reasons | M21 AC13, AC14, M22 AC20 |
| Reopen, new linked issue | Within 10 business days of "Closed at": Reopen with reason, status In progress, acknowledge clock restarts; after that: "Report a new issue linked to <ID>" opens the M17 form prefilled with "Related to <ID>" | M22 AC15, AC16 |
| Take over communication | Customer Success user while the communicator is absent; `TAKEN_OVER`; hidden on partner-only entities | M22 AC17 |
| Root cause report task | Created on resolution (owner or cascade) when Sev-1 at a regulated customer and no task exists; due = resolution date + "Post-incident report due (days)" read once; the named Compliance person joins as contributor; "Record report sent" by the owner | M27 AC1 to AC7, M26 AC9 |

---

## 5. UI system and screens (part 1)

This section covers the design system (5.1), the app shell S0 (5.2), Home S1 (5.3), Search and the Obligations view S2 (5.4), the New customer wizard S3 (5.5) and the Handoff screen S6 (5.6). Copy in double quotes is exact: use it character for character. Copy marked "(proposal)" was proposed by the screen spec and is approved for the build; use it as written. `<x>` marks a value inserted at runtime. All dates display as `02 Oct 2026`; "today" is the current date in Europe/Bucharest; "business days" are Monday to Friday with no holiday calendar.

Route conventions used below (align with the entity record section): the entity record lives at `/entities/[id]` (opens Overview) and `/entities/[id]/[tab]` with tab slugs `overview`, `details`, `products`, `contacts`, `history`, `partner`, `compliance`, `billing`, `audit`. Group record: `/groups/[id]`. A deep link to a field or card uses a hash, for example `/entities/[id]/details#renewal-date`, `/entities/[id]/contacts#contact-<contactId>`, `/entities/[id]/compliance#kyb-licence`.

---

### 5.1 Design system

**Release:** R1 (tokens, typography, status colours and every component are built in milestone 1 and used by both releases).

#### 5.1.1 Tokens (`app/globals.css`)

Brand tokens, copied from the Corvane brand guide. Do not change these values.

```css
:root {
  --color-primary: #073333;
  --color-primary-dark: #041F1F;
  --color-surface: #FFFFFF;
  --color-background: #FAFAFA;
  --color-tint: #F5FAFA;
  --color-tint-strong: #EDF5F5;
  --color-selected: #DAEBEB;
  --color-selected-hover: #CEEBEB;
  --color-text: rgba(0, 0, 0, 0.87);
  --color-text-secondary: rgba(0, 0, 0, 0.60);
  --color-text-disabled: rgba(0, 0, 0, 0.38);
  --color-border: rgba(0, 0, 0, 0.12);
  --color-success: #008148;
  --color-due-soon: #BA450B;
  --color-danger: #96031A;
  --color-link: #118AB2;
  --color-scheme-eu-vop: #003399;
  --color-scheme-uk-cop: #004225;
  --color-highlight: #CBA135;
  --font-sans: "DM Sans", Arial, sans-serif;
  --font-mono: "DM Mono", ui-monospace, monospace;
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 16px;
  --radius-pill: 100px;
  --shadow-soft: 0 0.5rem 4rem rgba(0, 0, 0, 0.08);
}
```

Additional tokens for states and accessibility (derived from the brand palette; add them in the same `:root`):

```css
:root {
  --color-backdrop: #041F1FE6;          /* modal and drawer backdrop, brand dark at 90% */
  --color-neutral-100: #EEEEEE;         /* neutral chip fill, skeleton */
  --color-neutral-200: #E0E0E0;         /* disabled button fill, dividers */
  --color-neutral-300: #BDBDBD;         /* disabled borders */
  --color-border-strong: rgba(0, 0, 0, 0.45); /* input and checkbox borders, 3.4:1 on white */
  --color-link-text: #0B6E8E;           /* text links and evidence links, 5.8:1 on white; --color-link stays for icons and the info rule */
  --color-focus: #073333;               /* focus ring on light surfaces; white on --color-primary-dark */
  --shadow-overlay: 0 0.5rem 2rem rgba(0, 0, 0, 0.16); /* dialogs, drawers, popovers, toasts */
}
```

There is no dark theme in the MVP. `body` uses `background: var(--color-background); color: var(--color-text); font-family: var(--font-sans);`. Load DM Sans (400, 500, 600, 700) and DM Mono (400, 500) with `next/font/google`.

#### 5.1.2 Tailwind mapping (`tailwind.config.ts`)

Map brand tokens to Tailwind names and point the shadcn/ui semantic names at the same variables, so every shadcn component inherits the brand without HSL variables.

```ts
theme: {
  extend: {
    colors: {
      primary: { DEFAULT: 'var(--color-primary)', dark: 'var(--color-primary-dark)', foreground: '#FFFFFF' },
      surface: 'var(--color-surface)',
      background: 'var(--color-background)',
      tint: { DEFAULT: 'var(--color-tint)', strong: 'var(--color-tint-strong)' },
      selected: { DEFAULT: 'var(--color-selected)', hover: 'var(--color-selected-hover)' },
      text: { DEFAULT: 'var(--color-text)', secondary: 'var(--color-text-secondary)', disabled: 'var(--color-text-disabled)' },
      border: { DEFAULT: 'var(--color-border)', strong: 'var(--color-border-strong)' },
      success: 'var(--color-success)',
      due: 'var(--color-due-soon)',
      danger: 'var(--color-danger)',
      link: { DEFAULT: 'var(--color-link)', text: 'var(--color-link-text)' },
      scheme: { euvop: 'var(--color-scheme-eu-vop)', ukcop: 'var(--color-scheme-uk-cop)' },
      highlight: 'var(--color-highlight)',
      neutral: { 100: 'var(--color-neutral-100)', 200: 'var(--color-neutral-200)', 300: 'var(--color-neutral-300)' },
      // shadcn/ui semantic names
      foreground: 'var(--color-text)',
      muted: { DEFAULT: 'var(--color-tint)', foreground: 'var(--color-text-secondary)' },
      accent: { DEFAULT: 'var(--color-selected)', foreground: 'var(--color-primary)' },
      secondary: { DEFAULT: 'transparent', foreground: 'var(--color-primary)' },
      destructive: { DEFAULT: 'var(--color-danger)', foreground: '#FFFFFF' },
      input: 'var(--color-border-strong)',
      ring: 'var(--color-focus)',
      card: { DEFAULT: 'var(--color-surface)', foreground: 'var(--color-text)' },
      popover: { DEFAULT: 'var(--color-surface)', foreground: 'var(--color-text)' },
    },
    fontFamily: { sans: ['var(--font-sans)'], mono: ['var(--font-mono)'] },
    borderRadius: { sm: 'var(--radius-sm)', DEFAULT: 'var(--radius-sm)', md: 'var(--radius-md)', lg: 'var(--radius-lg)', pill: 'var(--radius-pill)' },
    boxShadow: { soft: 'var(--shadow-soft)', overlay: 'var(--shadow-overlay)' },
    fontSize: { /* see 5.1.3 */ },
    screens: { md: '1024px', lg: '1280px', xl: '1440px' },
  },
}
```

#### 5.1.3 Typography scale (dense internal tool)

| Token | Size / line height | Weight | Letter spacing | Use |
|---|---|---|---|---|
| `text-page` | 24px / 32px | 600 | -0.01em | Page titles ("My worklist", "Search", "New customer", "Handoff: <entity>") |
| `text-section` | 18px / 26px | 600 | -0.01em | Card and section titles, dialog titles |
| `text-subsection` | 16px / 24px | 600 | -0.01em | Sub-headers inside cards (Compliance bucket headers, wizard sub-cards) |
| `text-body` | 14px / 20px | 400 | 0 | Body, table cells, inputs, list rows |
| `text-body-strong` | 14px / 20px | 500 | 0 | Entity names in rows, buttons, active nav |
| `text-meta` | 13px / 18px | 400 | 0 | Helper text, field errors, "Owned by <Team>", timestamps, rule hints |
| `text-label` | 13px / 18px | 500 | 0 | Form labels, table headers |
| `text-chip` | 12px / 16px | 500 | 0.01em | Chips, badges, counters |
| `font-mono` | same size as context | 400 | 0 | LEI, BIC, contract IDs, handoff and record IDs |

Weight 600 for headings, 500 for buttons. Display weight 900 is never used.

#### 5.1.4 Layout grid and breakpoints

- Desktop first. Design width 1280px; every screen must be complete at 1280px.
- Page area: max content width 1440px, 24px side padding, background `--color-background`. Spacing scale 4px base (4, 8, 12, 16, 24, 32, 48).
- At 1024px: every screen works with no horizontal page scroll. Wide tables scroll horizontally inside their card. Specific 1024px behaviours are listed per screen.
- Below 1024px: no layout commitment in the MVP; content stays readable and tables scroll inside cards.

#### 5.1.5 Status colour mapping (single source: `lib/ui/status.ts`)

Every status renders as a chip with text (colour is never the only signal). Chip variants:

| Variant | Fill | Text | Border |
|---|---|---|---|
| `success` | `--color-success` | white | none |
| `due` | `--color-due-soon` | white | none |
| `due-outline` | `--color-surface` | `--color-due-soon` | 1px `--color-due-soon` |
| `danger` | `--color-danger` | white | none |
| `danger-outline` | `--color-surface` | `--color-danger` | 1px `--color-danger` |
| `neutral` | `--color-neutral-100` | `--color-text` | none |
| `neutral-outline` | `--color-surface` | `--color-text-secondary` | 1px `--color-neutral-300` |
| `muted` | `--color-tint` | `--color-text-secondary` | 1px dashed `--color-neutral-300` |
| `brand` | `--color-primary` | white | none |
| `selected` | `--color-selected` | `--color-primary` | none |
| `scheme-eu` | `--color-scheme-eu-vop` | white | none |
| `scheme-uk` | `--color-scheme-uk-cop` | white | none |
| `admin` | `--color-highlight` | `--color-primary` | none |

| Domain | Value (label) | Variant |
|---|---|---|
| Worklist bucket | "Overdue" | `danger` |
| | "≤30 days" | `due` |
| | "31-60 days" | `due-outline` |
| | "61-90 days" | `neutral` |
| | "91-120 days" (CS renewals only) | `neutral-outline` |
| | "Waiting <n> days" (handoff rows after 2 business days) | `due` |
| | "Never verified" | `danger-outline` (proposal) |
| LEI status | "Issued" (ISSUED) | `success` |
| | "LEI lapsed" (LAPSED) | `due` |
| | "Retired", "Merged", "Annulled", "Duplicate" | `danger` |
| | "Pending transfer", "Pending archival" | `due-outline` |
| | "Not verified with GLEIF" | `neutral` |
| Lifecycle state | Onboarding | `neutral` |
| | Live | `success` |
| | BAU | `brand` |
| | "Inactive" | `muted` |
| Partner coverage | Onboarding | `neutral` |
| | Active | `success` |
| | Degraded | `due` |
| | Suspended | `danger` |
| | Retired | `muted` |
| | "Scheduled" (future effective date) | `neutral-outline` |
| KYB check | Not started | `neutral` |
| | Verified | `success` |
| | Expiring | `due` |
| | Expired | `danger` |
| Periodic review | Planned | `neutral` |
| | In progress | `neutral-outline` |
| | Completed | `success` |
| | Overdue | `danger` |
| Handoff status | Sent | `due` |
| | Confirmed, Accepted | `success` |
| | Declined | `danger` |
| | Cancelled | `neutral-outline` |
| Obligations expiry | "Expired" | `danger` |
| | "Expires in N days" (90 days or less) | `due` |
| Entity flags | "Incomplete for billing" | `due` |
| | Blocked (product) | `danger` |
| | "No active incident contact" | `danger` (critical, everywhere) |
| | "No owner" | `due-outline` with warning icon |
| Roles | "Customer", "Network partner" | `selected` |
| Match reason | "Customer product", "Partner coverage", LEI / BIC / Name (duplicate panel) | `selected` |
| Scheme tag | EU VoP | `scheme-eu` |
| | UK CoP | `scheme-uk` |
| | Global validation | `neutral-outline` |
| Admin | "Admin" | `admin` |
| Type chip | "Sales → Ops", "Ops → CS" | `selected` |

#### 5.1.6 Components (shadcn/ui restyled; Radix primitives)

| Component | Spec |
|---|---|
| **Button** | Radius 4px, weight 500. Sizes: `md` 36px high, 14px text, padding 8px 16px (default); `lg` 44px high, 16px text, padding 10px 19px (wizard footer primary, page-header primary such as "New customer"). Variants: **primary** fill `--color-primary`, white text, hover `--color-primary-dark`; **secondary** transparent, `--color-primary` text, 1px `--color-primary` border, hover fill `--color-tint-strong`; **destructive** fill `--color-danger`, white text (Delete, Discard, Reset demo data); **destructive-secondary** transparent, `--color-danger` text and 1px border ("Cancel handoff"); **text** no border, `--color-primary` text, underline on hover ("Cancel", "Clear filters", "Edit"). Disabled: fill `--color-neutral-200`, text `--color-text-disabled`, no hover, `aria-disabled` plus a tooltip when the spec gives one. Loading: spinner left of the label, label may change ("Creating customer..."), button disabled, form fields locked. Labels use a verb and an object. |
| **Icon button** | 32px square, radius 4px, `aria-label` required (clear, remove row, copy, close). |
| **Text input / textarea / number / date** | 36px high, radius 4px, 1px `--color-border-strong`, white fill, 14px, padding 8px 12px. Label above (13px 500), helper below (13px secondary). Focus: 2px `--color-focus` ring, 2px offset. Error: border `--color-danger`, message below in 13px `--color-danger` with an error icon, `aria-invalid` and `aria-describedby`. Character counter right-aligned under textareas with a max ("812 / 1,000"). Mono inputs (LEI, BIC) use `font-mono` and uppercase on input. Date display format `02 Oct 2026`. |
| **Select / searchable select / multi-select / multi-value chip input** | Radix Select or Popover + Command (cmdk). Same box as inputs. Multi-value inputs show one removable chip per value inside the field. Searchable lists show "No matches" when empty. |
| **Segmented control** | Radix ToggleGroup, single choice. Selected segment fill `--color-selected`, text `--color-primary` 500; others white with `--color-border-strong`. Used for "Mine | My team", "Institutions | Obligations", Type (Bank, Fintech, PSP), Currency. |
| **Checkbox / radio** | 16px box, 1px `--color-border-strong`, checked fill `--color-primary`. Hit area at least 24px. |
| **Table** | Header row fill `--color-tint`, 13px 500 `--color-text-secondary`, sticky in scrolling cards. Rows 40px min, 14px, 1px bottom `--color-border`, hover `--color-tint`, selected `--color-selected`. Numbers right-aligned. Empty cells show context copy ("Not set", "Not captured", "Not yet"), never a dash glyph. Sort headers are buttons with `aria-sort`. Pagination: "Previous", page numbers, "Next". |
| **Chip / badge** | Pill radius, 12px 500, height 22px, padding 0 8px, optional 12px leading icon. Variants and mapping in 5.1.5. Count pills on section titles use `neutral` (or `danger` when the section holds Overdue items). |
| **Tabs** | Radix Tabs (entity record). Tab 40px high, 14px 500 `--color-text-secondary`. Active: fill `--color-selected`, text `--color-primary` 600, 2px bottom border `--color-primary`. Hidden tabs are not rendered (never disabled). Arrow keys move between tabs. |
| **Card** | White, 1px `--color-border`, radius 8px, padding 16px (24px in the wizard). Header row: title (`text-section`), optional count pill, optional "Owned by <Team>" label, actions right-aligned. No shadow. |
| **Banner** | Full width of its container, radius 8px, padding 12px 16px, 4px left rule, icon, text, optional actions on the right. Variants: **info** fill `--color-tint-strong`, rule `--color-link`; **success** fill white, rule `--color-success`; **warning** fill white, rule `--color-due-soon` (amber in the spec means this); **danger** fill white, rule `--color-danger`; **danger-strong** fill `--color-danger`, white text (deleted record banner only). Uses `role="status"` (info, success, warning) or `role="alert"` (danger). |
| **Dialog** | Radix Dialog. Width 480px (confirm) or 640px (form). Backdrop `--color-backdrop`. Radius 16px, `--shadow-overlay`. Title (`text-section`), body, footer right-aligned: secondary or text button left of the primary. Destructive confirms use the destructive button. Esc and the close icon equal the cancel button. Focus moves to the first field (or the cancel button for pure confirms) and returns to the trigger on close. A failed save keeps the dialog open with values kept and shows the error inside the dialog. |
| **Drawer (sheet)** | Radix Dialog as a side sheet, 320px, from the left (Search filters at 1024px) or right. Same backdrop, focus trap and Esc behaviour as Dialog. |
| **Toast** | Bottom right, stacked, max 3 visible (oldest leaves first). 360px wide, white, radius 8px, `--shadow-overlay`, 4px left rule: success `--color-success`, error `--color-danger`, info `--color-link`. Icon, text, close icon. Success and info auto-dismiss after 5 seconds (pause on hover and focus); error stays until closed. Region `aria-live="polite"`; error toasts `role="alert"`. Built on Radix Toast (or sonner styled to this spec). |
| **Skeleton** | Blocks in `--color-neutral-100`, radius 4px, sized to the final content so nothing shifts when data arrives. Subtle pulse, none under `prefers-reduced-motion`. Page content uses skeletons; never a full-page spinner. |
| **Spinner** | 16px ring in `currentColor`, used inside buttons and inputs only. `aria-label` with the visible loading text. |
| **Stepper** | Horizontal, numbered circles 24px connected by a 1px line. States: **Current** fill `#073333` (`--color-primary`), white number, label 600; **Completed** check icon on `--color-primary` outline; **Not visited** outline `--color-neutral-300`, number and label `--color-text-secondary`; **Has errors** carmine `#96031A` dot and the label in carmine. `aria-current="step"` on the current step. Completed and current steps are buttons; unvisited steps are not focusable. |
| **Empty state** | Inside a section: one line in `--color-text-secondary` ("<Section title> · 0 · Nothing to do here"). Page level: centred text block, one short sentence naming what is missing, one action (button or link). |
| **Tooltip** | Radix Tooltip, dark fill `--color-primary-dark`, white 13px text, opens on hover and keyboard focus. Disabled buttons that have a tooltip stay focusable (`aria-disabled`, not `disabled`). |
| **Owner label ("Owned by <Team>")** | See 5.1.7. |
| **Copy-to-clipboard** | Icon button next to phone, email, LEI and BIC values; toast info "Copied" on success (proposal). |

#### 5.1.7 Read-only and the "Owned by <Team>" lock pattern (M15 AC7, AC8)

- One `<OwnedBy area={...} />` component. It reads the same permission matrix the server enforces (`lib/permissions/matrix.ts`, M15 AC3) and renders only when the current user cannot edit that data area. Never hard-code a label per screen.
- Rendering when the user lacks edit rights on a section:
  - lock icon (14px, `aria-hidden`) + text in `text-meta`, `--color-text-secondary`, placed in the section header (or per field group when ownership is mixed inside one tab, M15 AC8);
  - values render as plain text (not disabled inputs), and stay selectable for copying;
  - Edit, Add and Delete controls for that section are not rendered (never shown disabled).
- Exact labels, nothing else: "Owned by Sales", "Owned by Ops", "Owned by Customer Success", "Owned by Network", "Owned by Compliance", "Owned by Finance", "Owned by Sales and Customer Success" (always on Champion and Decision maker contacts in the Customer context, even for editors, resolution 47), "Owned by Sales and Finance" (commercial terms).
- Exception: the owner block never carries the label. "Owned by Customer Success" appears as the tooltip of the Reassign control position for users who cannot reassign (M9 AC3, resolution 43).
- 403 on save (M15 AC10): toast "You can't edit this. Owned by <Team>. Your team: <Team>.", unsaved values for that section are discarded, the section re-renders read-only.

#### 5.1.8 Logo usage

- Lockup: Corvane mark + "Corvane" wordmark, a 1px divider, then "Customer Hub" in DM Sans 600. "Corvane" names the company, "Customer Hub" the product. Legal entity names keep their own spelling ("Corvane Europe B.V.", "Corvane Singapore Pte. Ltd.").
- Do not hotlink the logo files from the Corvane CDN. Use this inline SVG placeholder (component `components/brand/Logo.tsx`), which a real SVG can replace later at the same size:

```tsx
export function Logo({ tone = 'forest', compact = false }: { tone?: 'forest' | 'white'; compact?: boolean }) {
  const color = tone === 'forest' ? 'var(--color-primary)' : '#FFFFFF';
  return (
    <span className="inline-flex items-center gap-2" style={{ color }} aria-label="Corvane Customer Hub">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 2.5 20.25 7.25v9.5L12 21.5l-8.25-4.75v-9.5L12 2.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      </svg>
      <span className="font-sans font-bold text-[18px] tracking-[0.04em]">Corvane</span>
      {!compact && (
        <>
          <span className="h-5 w-px bg-current opacity-30" aria-hidden="true" />
          <span className="font-sans font-semibold text-[16px]">Customer Hub</span>
        </>
      )}
    </span>
  );
}
```

- Forest (`--color-primary`) on light surfaces, white on `--color-primary-dark`. Minimum clear space: 8px on every side. No recolouring, no shadows, no stretching. Gilmer is not used; DM Sans everywhere.

#### 5.1.9 Voice and copy rules

- English, British spelling everywhere (licence, organisation, authorised, cancelled, normalise).
- Sentence case for buttons, tabs, headings and labels. No Title Case.
- Formal, factual, specific. Name the scheme and the number ("EU VoP", "UK CoP", "expires in 30 days"). No jokes, no emoji, no exclamation marks. No em dashes in any UI string.
- "We" for Corvane, "you" for the user.
- Buttons use a verb and an object ("Create customer and hand over", "Confirm pickup", "Mark as verified", "Reassign owner").
- Empty states name what is missing and give one action.
- Errors name the cause and the fix.
- Dates and deadlines are always concrete: "Licence expires in 23 days (25 Oct 2026)". Date format `02 Oct 2026`; timestamps add time and UTC offset where the spec asks (Audit).
- Team names in labels stay fixed: "Owned by Compliance", "Adrian Koh, Ops", "Emma Wilson, Customer Success". The arrows in "Sales → Ops", "Ops → CS" and "Active → Degraded" are part of the copy.
- Vocabulary: payee verification, Verification of Payee (VoP), Confirmation of Payee (CoP), global validation, coverage, network, partner.

#### 5.1.10 Accessibility minimums (WCAG 2.2 AA)

| Pair | Ratio | Rule |
|---|---|---|
| `--color-text` on white | 15.8:1 | body |
| `--color-text-secondary` on white / `--color-tint` / `--color-neutral-100` | 5.7 / 5.5 / 5.0:1 | secondary text allowed on these fills |
| `--color-primary` on white / `--color-selected` | 13.7 / 11.2:1 | |
| White on `--color-success` / `--color-due-soon` / `--color-danger` | 5.0 / 5.3 / 9.0:1 | solid chips pass |
| `--color-link` (#118AB2) on white | 4.0:1 | fails for text: use only for icons, banner rules, focus-independent decoration. Text links use `--color-link-text` (5.8:1) with underline on hover and focus |
| `--color-highlight` (gold) on white | 2.4:1 | never as text colour; only as the Admin badge fill with `--color-primary` text (5.7:1) |
| `--color-text-disabled` | 3.0:1 | only for disabled controls and placeholders |
| `--color-border-strong` on white | 3.4:1 | input, checkbox and select boundaries (non-text 3:1) |

- Focus: every interactive element shows a visible 2px `--color-focus` ring with 2px offset on `:focus-visible` (white ring on the dark demo strip). Never remove outlines without a replacement.
- Keyboard: every action is reachable by keyboard in DOM order. A "Skip to content" link is the first focusable element. "/" focuses the global search from any screen when focus is not in a text field. Typeahead follows the ARIA combobox pattern (Up/Down to move, Enter to open, Esc to close). Dialogs and drawers trap focus, close on Esc and return focus to the trigger. Tabs and segmented controls use arrow keys. Tables with sortable headers use buttons in `th`.
- Semantics: one `h1` per page (the page title); section cards use `h2`. Status chips carry text; icons that carry meaning have an accessible name (lock icon via the visible "Owned by <Team>" text). Form errors are linked with `aria-describedby`. Loading regions use `aria-busy="true"`.
- Target size at least 24 by 24px for every control.
- Motion: respect `prefers-reduced-motion` (no skeleton pulse, no toast slide).

---

### 5.2 App shell (S0)

**Release:** R1 with demo strip, "View as", global search bar (Enter opens S2), user menu, Admin menu (Deleted records, Roles & permissions, Reset demo data), toasts, access and not-found pages; R2 adds search typeahead and the Admin entry "Users & roles" (7.6.6).

- **Route:** wraps every authenticated route through the root layout `app/(app)/layout.tsx`. Access, not-found and deleted-record pages render inside the shell.
- **Purpose:** navigation, global search, identity, demo team switching ("View as"), shared feedback (toasts, access pages, loading and error).
- **Demo priority:** P1 (Core in all scenarios).

#### Layout regions (top to bottom)

1. **Demo strip** (only when `DEMO_MODE=true`): 32px high, background `--color-primary-dark`, white text. Left: the label "Demo mode". Right: the "View as" switcher. No demo data banner anywhere in the app.
2. **Top bar:** 56px, white surface, 1px bottom border `--color-border`. Left to right: logo lockup (5.1.8) | "Home" link with badge | global search bar (flexible width, max 560px) | "Admin" entry (admin and Compliance only) | user menu.
3. **Page area:** `--color-background`, max content width 1440px, 24px side padding. Page title row, then the screen content.
4. **Toast region:** bottom right, stacked, max 3 visible.

**At 1024px:** the search bar shrinks to a minimum of 280px; the "Customer Hub" wordmark collapses to the logo only (`compact`); the user menu shows initials only; "View as" shows "View as: Ops" in a compact select. The shell never scrolls horizontally.

#### Components

| Component | Spec |
|---|---|
| Logo lockup | Corvane logo + "Customer Hub". Click opens Home (`/`). |
| Home link | Label "Home". Active state: `--color-selected` background pill. Badge: count of unacknowledged "Ownership assigned to you" items for the current user (M9 AC9 only), pill `--color-primary`, white digits, hidden at 0. Example for Emma Wilson: "Home 1". `aria-label="Home, 1 unacknowledged assignment"`. From milestone 6C the badge also counts the Issues rows where the user has a step and turns red (`--color-danger`) when one of them is overdue or is a Sev-1 with status New (M20 AC9, 4.6.9); the `aria-label` names both counts, for example "Home, 1 unacknowledged assignment, 2 issue steps". |
| Global search bar (M1 AC1) | Text input, placeholder "Search by name, alias, LEI or BIC", magnifier icon, clear (x) icon button when filled. Enter opens `/search?q=<query>`. "/" focuses the bar from any screen (proposal). |
| Typeahead (proposal) | Opens after 2 characters, debounce 200ms. Up to 5 best matches, each row: legal name, matched alias if any ("Matched alias: MPS"), country, role chips, LEI in DM Mono. Last row "See all results for '<query>'" (opens S2). Selecting a match opens `/entities/[id]` on Overview, so the Network path is type, select, read header (M1 AC13). Same matching, ranking and exclusion rules as S2: soft-deleted never shown, Inactive shown with the "Inactive" chip. Uses the S2 search service with `limit=5`. |
| Admin entry (M15 AC2, AC12, AC13) | Rendered only for the admin flag holder and Compliance users (never rendered disabled). Admin (Adrian Koh, Ops) menu: "Users & roles", "Deleted records", "Roles & permissions" and, when `DEMO_MODE` is on, "Reset demo data". Compliance (Mei Chen): "Roles & permissions" only. The gold "Admin" badge (variant `admin`) shows next to the label for the admin only. |
| Reset demo data (admin, `DEMO_MODE` only; M16 AC16, resolution 4) | Confirm dialog: title "Reset all demo data? Every change made since the last reset is lost.", buttons "Reset demo data" (destructive) and "Cancel". On success: seed reloaded, every seed date recalculated from today, every user returned to Home, toast "Demo data reset". The endpoint returns 404 when `DEMO_MODE` is off. |
| User menu | Avatar with initials, name and team: "Adrian Koh · Ops" with the "Admin" badge, or "Emma Wilson · Customer Success". Items: name and email (read-only), team (read-only), "Sign out". In `DEMO_MODE` the app signs in automatically as the "View as" user and "Sign out" is hidden. Production uses company SSO (out of scope). No session expiry. |
| "View as" switcher (M15 AC11) | Only when `DEMO_MODE` is on. Label "View as", select with 6 options (team and seeded user): Sales = Tom Hadley; Ops = Adrian Koh (admin); Customer Success = Emma Wilson; Network = Lukas Brenner; Compliance = Mei Chen; Finance = Rachel Wong. Secondary users (Kevin Lim, Michael Reed, Leo Martin, Sophie Mitchell, Ethan Brooks, Nora Lee) are not in the switcher. |

**"View as" behaviour:**
- Switching sets the session cookie to the chosen seeded user (server action) and reloads the current page with that user's rights, worklist and visible tabs. Home opens on "Mine" (M11 AC23).
- Toast after switching: "Now viewing as <name> (<team>)" (proposal), for example "Now viewing as Emma Wilson (Customer Success)".
- When the new user cannot see the current page (Audit tab, Admin pages, wizard, Ops → CS form), the app opens Home with the toast "You don't have access to that page as <team>" (resolution 59).
- From the wizard, switching first opens the "Discard this new customer?" dialog (S3 leaving rule).
- Every action while impersonating is checked by the server and audited as the impersonated user and team (M16 edge case 2).

#### Access and record pages (render in the page area; shell stays; HTTP status in brackets)

| Page | Trigger | Copy | Actions |
|---|---|---|---|
| No access to Admin [403] | A non-admin opens `/admin/users` or `/admin/deleted-records`, or a team other than Compliance (and not the admin) opens `/admin/roles-permissions` | "You don't have access to Admin. Ask Adrian Koh (Ops)." | "Go to Home" (proposal) |
| Wizard not allowed [403] | A non-Sales user opens `/customers/new` (M2 AC1, M15 edge case 5) | "Only Sales can create a customer record" | link "Go to search" |
| Audit tab not allowed [403] | A non-Compliance, non-admin user opens `/entities/[id]/audit` (tab not rendered, API 403, M16 AC4) | "The audit log is visible to Compliance and the admin." (proposal) | "Open the Overview" (proposal) |
| Soft-deleted record, non-admin [410 or 404] | Any URL of a deleted entity or its handoffs (M16 AC11) | "This record was deleted on <date>. Contact the admin, Adrian Koh, if it should be restored." No entity data, no header, no tabs. | "Go to search" (proposal) |
| Soft-deleted record, admin [200] | Same URL as the admin | Full record read-only with the danger-strong banner "Deleted by Adrian Koh on <date>. Reason: <reason>" and "Reactivate" (specified with the entity record) | Reactivate |
| Not found [404] | Unknown entity ID, group ID, handoff ID or route (resolution 61) | "We couldn't find that page. Search for a customer or go to Home." | "Go to search", "Go to Home" |
| No access after "View as" | "View as" switches to a user who cannot see the current page | Home opens with toast "You don't have access to that page as <team>" | none |

#### Actions

| Action | Who | Result | ACs |
|---|---|---|---|
| Search from the top bar | All 6 teams | Opens S2 or a record | M1 AC1, AC16 |
| Open Home | All 6 teams | Team worklist | M11 AC1 |
| Open Admin > Users & roles / Deleted records | Admin only | Admin screens | M15 AC2, AC12 |
| Open Admin > Roles & permissions | Admin and Compliance | Read-only matrix (S7.3) | M15 AC12, AC13 |
| Reset demo data | Admin, `DEMO_MODE` on | Seed restored, Home opens | M16 AC16 |
| Switch "View as" | Anyone, `DEMO_MODE` on | Session re-signed, page reloads or Home opens | M15 AC11, M11 AC23 |
| Reactivate from the deleted-record page | Admin only | Record returns to search and worklists | M16 AC11, AC13 |

#### States

- **Loading (global):** 2px progress bar in `--color-primary` under the top bar on route changes (proposal). Page content uses skeletons, never a full-page spinner; the shell stays usable.
- **Error pattern:** errors appear where the work happened: inline under the field for validation; inside the dialog for failed saves (dialog stays open, values kept); in the section for failed loads with "Retry". Messages name the cause and the fix.
- **Server unreachable (proposal):** danger banner under the top bar "We couldn't reach Customer Hub. Check your connection and try again." with "Retry".
- **403 on save (M15 AC10):** toast "You can't edit this. Owned by <Team>. Your team: <Team>.", unsaved values for that section discarded, section re-rendered read-only. Server body `{"error":"forbidden","owner_team":"<Team>"}` (M15 AC9).
- **Concurrent edit (shared pattern):** the second save is rejected with the story's message, for example "This coverage was updated by Nora Lee at 10:42. Reload to see the latest status." (M5 edge case 3) and "Owner was changed by <name> at <time>. Reload to see the current owner." (M9 edge case 1). Implement with an `updatedAt` version check in the service layer.
- **Read-only:** the shell has no editable data. The Admin entry is not rendered for users who are neither the admin nor Compliance.
- **`DEMO_MODE` off:** no demo strip, no "View as", no "Reset demo data"; the user menu shows name, team and "Sign out".

**Known toast strings:** "Owner changed to Sophie Mitchell" (M9 AC7); "Verification saved" (KYB save, M12 AC9, proposal); "You can't edit this. Owned by Compliance. Your team: Sales." (M15 AC10); "Demo data reset"; "Now viewing as <name> (<team>)"; "You don't have access to that page as <team>".

**ACs covered:** M1 AC1, AC10, AC13, AC16; M2 AC1; M9 AC9 (badge); M15 AC2, AC3, AC7, AC9, AC10, AC11, AC12, AC13, edge case 5; M16 AC4, AC8, AC11, AC16, edge case 2.

---

### 5.3 Home: my worklist (S1)

**Release:** R1 with the R1 sections of 7.6.5 on the "Mine" scope (Compliance: all institutions), Home badge, summary strip, inline Acknowledge and states; R2 adds the "Mine / My team" toggle, "Waiting <n> days" pins and the Ops "Handoff declined", Network, Finance and Sales sections.

- **Route:** `/` (default landing after sign-in). Query: `?scope=mine|team` (default `mine`; `team` only for Ops and CS).
- **Purpose:** per team, the items that need action today, computed from current data on every load (no stored list, M11 AC2).
- **Demo priority:** P1.

#### Layout regions

1. **Page header:** title "My worklist"; subtitle "<Name> · <Team> · <Weekday> <date>" (proposal), for example "Adrian Koh · Ops · Friday 02 Oct 2026". Right: scope control (Ops and CS) or scope line (other teams); for Sales only, the primary `lg` button "New customer" (M2 AC1).
2. **Summary strip (proposal):** one compact counter per section in section order ("<Section title> <n>"), each a link that scrolls to its section. A counter whose section holds Overdue items shows the count in `--color-danger`.
3. **Sections:** one card per rule, stacked in a single column, in the team order below. Card header: section title (`h2`), item count pill, one-line rule hint in `text-meta` secondary (for example "Limit 21 days"). Then item rows. A section with 0 items collapses to one line.

**At 1024px:** the summary strip wraps to 2 lines; item rows move the secondary column (sent date or verified-by) to a second text line under the entity name (proposal).

#### Scope (M11 AC3, AC23; resolutions 8 to 10)

| Team | Control | Mine | My team |
|---|---|---|---|
| Ops, CS | Segmented "Mine | My team", default "Mine" | Entities where the user is current owner, plus handoffs addressed to or sent by the user | Same rules for all users of the same team, including entities with no owner (M11 edge case 6). Confirm and Accept controls stay reserved for the named recipient |
| Sales | Read-only scope line "Customers you created" (proposal) | Entities the user created and the Sales → Ops handoffs the user sent | n/a |
| Compliance, Network, Finance | Read-only scope line "All institutions" (proposal) | All entities | n/a |

After CS accepts an Ops → CS handoff, Ops items on that entity (blocks, go-lives, stage thresholds) show for every Ops user under "My team", and under "Mine" for the Ops user who sent the handoff (resolution 10). "View as" always opens on "Mine".

#### Item row anatomy (M11 AC4)

| Element | Content |
|---|---|
| Status chip | Bucket chip where relevant ("Overdue", "≤30 days", "31-60 days", "61-90 days", "91-120 days" for CS renewals only); handoff rows "Waiting <n> days" after 2 business days |
| Entity | Legal name (`text-body-strong`) + country code, for example "Santander UK plc · GB" |
| Rule label | for example "Blocked", "Licence expiry", "Renewal" |
| Key value with date | for example "Licence expires in 23 days (25 Oct 2026)" |
| Context | rule-specific detail (sender, reason, missing fields) |
| Open | link "Open" to the exact tab and field, or to the Handoff screen for handoff rows |

- **Rows are read-only (M11 AC19, AC25; resolution 13):** no dismiss, snooze, hide or inline edit. The only inline action is "Acknowledge" on "Ownership assigned to you" rows. "Mark as verified" happens on the Contacts tab, reached from the row.
- **Highlighted (waiting) rows:** mahogany 4px left rule and chip "Waiting <n> days".
- **Sort (M11 AC1, resolution 15):** Overdue first; date-based rules then soonest date first; elapsed-time rules (Blocked, Too long in current stage, Champion left) longest elapsed first. Exceptions: "To pick up" rows past 2 business days move to the top (M3 AC18, M11 AC5); Network "Never verified" first (M11 AC14); Finance "Incomplete billing profiles" by number of missing or invalid fields, most first (M11 AC16). Ties: legal name A to Z (proposal).
- **Excluded:** soft-deleted and Inactive entities never appear (M11 AC21, M16 AC10). Cancelled product lines never count. A pending handoff on a deleted entity leaves both lists and returns on reactivation (M8 edge case 5).

#### Issues section (M20, milestone 6C)

"Issues" is the first section on Home for every team, above the team sections below, with its own "Mine / My team" control for Ops and CS in R1 (4.6.9). Rules, groups ("Contributing", "Reported by me"), steps, order, count and refresh: 4.6.9. Row anatomy, layout and copy: design brief section 6 and 6.13.6. Seed oracles: 7.1.17.8. The summary strip shows "Issues <n>" first.
#### Sections by team

**Ops (section order: To pick up, Awaiting acceptance, Handoff declined, Blocked, Go-lives in the next 14 days, Too long in current stage, Required fields empty, Ownership assigned to you)**

| Section title | Rule | Row content | Sort | Leaves when | ACs |
|---|---|---|---|---|---|
| "To pick up" | `Sales → Ops` handoffs, status Sent, addressed to the user ("My team": to any Ops user; other Ops users see them read-only with the recipient named) | Legal name, country, products, earliest target go-live, Sales sender, recipient (My team only), sent date, days waiting. After 2 business days: chip "Waiting <n> days", row pinned to top. Open = Handoff screen with "Confirm pickup" | Waiting rows first (most days first), then sent date oldest first | Pickup confirmed, or Sales changes the Onboarding Manager | M3 AC11, AC12, AC18, edge case 3; M11 AC5 |
| "Awaiting acceptance" | `Ops → CS` handoffs, status Sent, sent by the user | Legal name, country, receiving CSM, sent date, days pending. Highlighted after 2 business days. If the CSM left the CS team: "Recipient no longer in Customer Success" | Highlighted first, then oldest sent first | CSM accepts or declines, or any Ops user cancels | M8 AC9, AC13, edge case 2; M11 AC5 |
| "Handoff declined" | `Ops → CS` handoffs sent by the user and declined | "Handoff declined by <CSM>: <reason>", declined date. Open = entity record, where "Hand over to Customer Success" is available | Newest decline first | User sends a new handoff for that entity | M8 AC12; M11 AC5 |
| "Blocked" | Any product with the blocked flag set | "<Product> / <Country> blocked by <Customer, Corvane or Partner> for <n> days", reason, blocked since. Open = band on Products & onboarding | Most days blocked first | Blocked flag cleared | M6 AC7, AC14; M11 AC7 |
| "Go-lives in the next 14 days" | Target go-live from today to today + 14 inclusive, stage before Live & hypercare | "<Product> / <Country>: target go-live in <n> days (<date>)", current stage. Chip "≤30 days" | Soonest first | Stage reaches Live & hypercare, or target leaves the window | M3 AC18; M11 AC8 |
| "Too long in current stage" | Days in stage above threshold: more than 21 days for Contract signed through Go-live approval; more than 56 days for Live & hypercare; Ramp-up and BAU excluded. Thresholds are configuration constants | "<Product> / <Country>: <n> days in <stage> (since <date>)", hint "Limit 21 days" (or "Limit 56 days"). Open = band | Oldest stage entry first | Stage changes | M11 AC6 |
| "Required fields empty" | Customer role and at least one product in Contract signed through Live & hypercare, with any of: LEI, entity type, country, applicable contract, active Technical contact, active Incident contact, target go-live on every product before Live & hypercare, group decision. Only Ops-owned Customer-context contacts count | "Missing: <field names>", using "No contract attached" and "Group not set" for those two. Open = Details tab (LEI, type, country, contract, group), Contacts tab (contacts), band (target go-live). Every wizard-created customer lands here (resolution 30) | Most missing fields first | All listed fields filled | M2 AC19; M4 AC15; M11 AC9, edge case 4 |
| "Ownership assigned to you" | M9 assignment for the user, unacknowledged | As the CS row | Newest first | Acknowledged | M9 AC9, AC10; M11 AC12 |

**Customer Success (section order: Ownership assigned to you, To pick up, Renewals in the next 120 days)**

| Section title | Rule | Row content | Sort | Leaves when | ACs |
|---|---|---|---|---|---|
| "Ownership assigned to you" | Unacknowledged M9 assignment for the user; never created for self-assignment | Entity, previous owner, who reassigned, date, reason. Inline "Acknowledge" button and "Open" | Newest first | Acknowledged here or on the entity banner; removed if reassigned again before acknowledgement | M9 AC9, AC10, AC11; M11 AC12 |
| "To pick up" | `Ops → CS` handoffs, status Sent, addressed to the user | Entity, country, sender, sent date, days pending. Highlighted after 2 business days. Open = Handoff screen with "Accept" and "Decline" | Highlighted first, then oldest sent first | Accepted, declined or cancelled, or the user leaves the CS team | M8 AC10, AC13; M11 AC10 |
| "Renewals in the next 120 days" | Customer role renewal date from today to today + 120, plus passed dates | "Renewal in <n> days (<date>)" or "Renewal date passed (<date>)". Chips "Overdue", "≤30 days", "31-60 days", "61-90 days", "91-120 days". Open = Details tab, Customer role renewal date | Overdue first, then soonest | Renewal date moved more than 120 days away | M11 AC11 |

**Network (one section)**

| Section title | Rule | Row content | Sort | Leaves when | ACs |
|---|---|---|---|---|---|
| "Partner contacts not verified for 90+ days" | Active Network-owned contacts on entities with a partner role, last verified more than 90 days ago (from 91 days) or empty | Entity, contact name and role, "Verified <n> days ago by <name> (<date>)" or "Never verified". Open = Contacts tab, that contact | "Never verified" first, then oldest verification | Last verified updated, or contact marked Left | M7 AC13; M11 AC14, edge cases 3, 4 |

**Compliance (one section, "KYB and review expiries", with 4 bucket sub-headers: Overdue, ≤30 days, 31-60 days, 61-90 days)**

| Rule | Row copy | Sort | Leaves when | ACs |
|---|---|---|---|---|
| Licence checks by expiry date; LEI checks by GLEIF next renewal date; LEI with GLEIF status LAPSED, RETIRED, MERGED, ANNULLED or DUPLICATE as Overdue (one item, even when a renewal date is near); periodic reviews by next review date. LEI items read the LEI KYB check (resolution 16). Beyond 90 days excluded; licences with "No expiry date" never listed. A licence expiring exactly 30 days from today is in ≤30 days | "Licence expires in <n> days (<date>)", "LEI renewal in <n> days (<date>)", "LEI lapsed in GLEIF", "Periodic review due in <n> days (<date>)" (proposal), "Periodic review overdue since <date>". Open = Compliance tab, that card | Overdue first, then soonest | Date moved more than 90 days away, or GLEIF status returns to ISSUED | M2 AC19; M11 AC13, edge cases 2, 3; M12 AC8 |

**Finance (section order: Incomplete billing profiles, Billing contacts not verified for 6+ months)**

| Section title | Rule | Row content | Sort | Leaves when | ACs |
|---|---|---|---|---|---|
| "Incomplete billing profiles (N)" | Customer role, not Inactive, not deleted, flag "Incomplete for billing". Entities billed through another entity carry no flag (resolution 55) | Entity, country, contracting Corvane entity (or "Not set"), number of missing or invalid fields, field names (in the context column; full list on hover, proposal). Row opens the Billing tab | Most missing or invalid fields first | Flag clears | M11 AC16; M14 AC11 |
| "Billing contacts not verified for 6+ months" | Active Billing contacts, last verified more than 6 calendar months ago or empty | Entity, contact name, "Verified <date> by <name>" or "Never verified". Open = Contacts tab, that contact | "Never verified" first, then oldest | Verified or marked Left | M7 AC13; M11 AC15 |

**Sales (section order: Awaiting pickup, Overdue go-lives, Champion left, Ownership assigned to you)**

| Section title | Rule | Row content | Sort | Leaves when | ACs |
|---|---|---|---|---|---|
| "Awaiting pickup" | `Sales → Ops` handoffs sent by the user, status Sent | Legal name, country, Onboarding Manager, sent date, days waiting. Chip "Waiting <n> days" after 2 business days. Open = entity record with the pending banner and "Change Onboarding Manager". After a recipient change the row stays and shows the new Onboarding Manager | Waiting first, then oldest sent | Onboarding Manager confirms the pickup | M3 AC11, AC13, edge case 3; M11 AC24 |
| "Overdue go-lives" | Products on entities created by the user, target go-live before today, stage before Live & hypercare | "<Product> / <Country>: <n> days late (target <date>)", current stage. Chip "Overdue". Open = band | Most days late first | Stage reaches Live & hypercare, or target moved to today or later | M3 AC18; M11 AC18 |
| "Champion left" | Entities created by the user with a Champion marked Left and no active Champion | "No active champion since <date>", name of the departed champion. Open = Contacts tab, Champion group | Longest without a champion first | An active Champion exists on the entity | M7 AC7; M11 AC17 |
| "Ownership assigned to you" | M9 item for the user | As CS | Newest first | Acknowledged | M11 AC12 |

#### Expected render with the seed (use as Playwright assertions; demo day Friday 02 Oct 2026, dates shift with today)

- **Adrian Koh, Mine:** To pick up 0 ("Nothing to pick up. New customers from Sales appear here."); My team adds "Banco Santander Consumer Portugal S.A. · PT | Global validation / PT | Earliest go-live 30 Nov 2026 | From Michael Reed to Kevin Lim (Ops), sent 29 Sep 2026 | Waiting 3 days" (pinned). Awaiting acceptance 0. Handoff declined 1: "Banco Santander Totta, S.A. · PT | Handoff declined by Sophie Mitchell: Portuguese accounts sit with Ethan Brooks from October". Blocked 1: "Revolut Ltd · GB | EU VoP / DE blocked by Customer for 8 days (since 24 Sep 2026): waiting for production certificates from the customer's security team". Go-lives 1: "Revolut Ltd · GB | Global validation / SG: target go-live in 9 days (11 Oct 2026) | Stage: Testing & certification" with chip "≤30 days". Too long 2: "Revolut Ltd · GB | UK CoP / GB: 60 days in Live & hypercare (since 03 Aug 2026)"; "Banco Santander Totta, S.A. · PT | EU VoP / FR: 38 days in Sandbox & technical integration (since 25 Aug 2026)". Required fields empty 1: "Lloyds Bank plc · GB | Missing: active Technical contact"; My team adds "Zopa Bank Limited · GB | Missing: No contract attached" (owner Kevin Lim). Ownership assigned 0.
- **Emma Wilson, Mine (Home badge 1):** Ownership assigned 1: "UniCredit Bank GmbH · NL | Assigned by Leo Martin on 01 Oct 2026 | Previous owner: Leo Martin | Reason: Rebalancing German accounts before Q4 | [Acknowledge] Open". To pick up 0 ("Nothing to pick up. Handoffs from Ops appear here."). Renewals 2: "UniCredit Bank GmbH · NL | Renewal date passed (22 Sep 2026)" chip "Overdue"; "Banca Monte dei Paschi di Siena S.p.A. · IT | Renewal in 75 days (16 Dec 2026)" chip "61-90 days". My team adds "Adyen N.V. · NL | Owner Leo Martin | Renewal in 100 days (10 Jan 2027)" chip "91-120 days".
- **Lukas Brenner (3):** "Adyen N.V. · NL | Escalation: Eva Smit | Never verified"; "Lloyds Bank plc · GB | Incident: Marta Kovacs | Verified 200 days ago by Lukas Brenner (16 Mar 2026)"; "Banco Santander Totta, S.A. · PT | Technical: João Ferreira | Verified 120 days ago by Lukas Brenner (04 Jun 2026)".
- **Mei Chen (6):** Overdue: "Banco Santander Consumer Portugal S.A. · PT | LEI lapsed in GLEIF"; "Banca Monte dei Paschi di Siena S.p.A. · IT | Periodic review overdue since 27 Sep 2026". ≤30 days: "Adyen N.V. · NL | Licence expires in 23 days (25 Oct 2026)"; "UniCredit Bank GmbH · NL | LEI renewal in 20 days (22 Oct 2026)" (real GLEIF renewal date, decision B3). 31-60 days: "Banco Santander Totta, S.A. · PT | Periodic review due in 45 days (16 Nov 2026)". 61-90 days: "Zopa Bank Limited · GB | Licence expires in 80 days (21 Dec 2026)".
- **Rachel Wong:** Incomplete billing profiles (3): "Zopa Bank Limited · GB | Not set | 9 fields (no billing profile yet)"; "UniCredit Bank GmbH · DE | Corvane Europe B.V. | 3 fields: VAT / tax ID, Postal code, Contract reference"; "Revolut Ltd · GB | Corvane Singapore Pte. Ltd. | 1 field: LEI (invalid format)". Billing contacts (1): "Banco Santander Totta, S.A. · PT | Billing contact verified 12 Mar 2026 by Rachel Wong".
- **Tom Hadley:** Awaiting pickup 0. Overdue go-lives 1: "Zopa Bank Limited · GB | UK CoP / GB: 6 days late (target 26 Sep 2026) | Stage: UAT" chip "Overdue". Champion left 1: "Santander UK plc · GB | No active champion since 20 Sep 2026 | Oliver Bennett". Ownership assigned 0. Button "New customer".

#### Actions

| Action | Who | Result | ACs |
|---|---|---|---|
| Open an item | All teams | Exact tab and field, or the Handoff screen | M11 AC4 |
| Confirm pickup (via the row, on S6) | Ops, named Onboarding Manager only | Confirmed, owner changes, row leaves | M3 AC12 |
| Accept or decline (via the row, on S6) | CS, chosen CSM only | Accepted: owner becomes CSM; Declined: row moves to sender's "Handoff declined" | M8 AC11, AC12 |
| Cancel handoff (from "Awaiting acceptance", on S6) | Any Ops user | Cancelled, row leaves | M8 AC13, AC15 |
| Change Onboarding Manager (from "Awaiting pickup", on the entity banner or S6) | Sales | Item moves to the new recipient's "To pick up" | M3 edge case 3 |
| Acknowledge | The new owner only | Row leaves, Home badge decreases by 1, audit entry written | M9 AC10 |
| Mark as verified (Network and Finance rows) | Owning team, on the Contacts tab reached from the row | Last verified = today; row gone on return to Home | M7 AC13 |
| Toggle Mine / My team | Ops and CS | Sections recomputed | M11 AC3, AC23 |
| New customer | Sales only | Wizard step 1 | M2 AC1 |

#### States

| State | Behaviour and copy |
|---|---|
| Empty section | Card collapsed to one line: "<Section title> · 0 · Nothing to do here". "To pick up" uses the story copy: Ops "Nothing to pick up. New customers from Sales appear here."; CS "Nothing to pick up. Handoffs from Ops appear here." |
| All sections empty | "Your worklist is clear" with link "Go to search" |
| Loading | One skeleton row per section; each section loads independently (one request or Suspense boundary per section), so a slow section never blocks the others. Summary counters show a skeleton until their section resolves |
| Error (per section) | "Could not load this list" with "Retry". Other sections still render |
| Read-only | Rows are views. A user who opens an item outside their editing area sees the target fields with the owning team label. Only "Acknowledge" acts from Home |
| After an action elsewhere | Returning to Home shows the item gone without a manual reload (M11 AC20): render Home dynamically (`dynamic = 'force-dynamic'`, no client cache) and revalidate after every write |
| Acknowledge failure | Row stays, error toast "Action not saved" |

**ACs covered:** M11 AC1 to AC25 and all M11 states and edge cases; M3 AC11, AC12 (entry), AC18, states; M8 AC10, AC12, AC13, states; M9 AC9, AC10, AC11; M7 AC7, AC13; M6 AC14; M2 AC1, AC19; M4 AC15; M14 AC11; M16 AC10, edge case 6.

---

### 5.4 Search and Obligations view (S2)

**Release:** R1 with query, Country and Scheme filters, partner chips, relevance sort, paging, URL state and the Obligations view with Customer rows, Incident notice filter and both sortable columns; R2 adds the Role, Stage, Coverage status, Lifecycle and Owner filters, user sorts, contract ID matching, Partner rows, the Subprocessor notice filter and "Only rows where this is not captured".

- **Route:** `/search`. All state in the query string (M1 AC19, M13 AC13): `q`, `country` (repeatable ISO alpha-2), `scheme` (`EU_VOP|UK_COP|GLOBAL_VALIDATION`, repeatable), `role` (`customer|partner|both`), `stage` (repeatable stage enum), `coverage` (`ONBOARDING|ACTIVE|DEGRADED|SUSPENDED|RETIRED`, repeatable), `lifecycle` (`ONBOARDING|LIVE|BAU|INACTIVE`, repeatable; absent = all except Inactive), `owner` (user ID or `none`, repeatable), `sort`, `dir`, `page`, `view` (`institutions|obligations`). Obligations adds `subMin`, `subMax`, `subMissing=1`, `incMin`, `incMax`, `incMissing=1`.
- **Purpose:** find any non-deleted institution by name, alias, LEI, BIC or contract ID, or list institutions by filters, and open its single record (M1). The Obligations view lists contractual obligations on the same screen (M13).
- **Demo priority:** P1.

#### Layout regions

1. **Header row:** title "Search"; query echo "Results for '<query>'" (proposal); result count "<n> institutions" (or "<n> agreements" in Obligations); view switch segmented "Institutions | Obligations"; sort select.
2. **Left filter panel:** 280px, sticky, collapsible sections per filter type; "Clear filters" link at the top.
3. **Active filter chips:** row above the results, one removable chip per selected value.
4. **Results:** table rows, 25 per page, pagination "Previous", page numbers, "Next".

**At 1024px:** the filter panel becomes a "Filters (n)" button that opens a left drawer; the results table moves the Group and LEI status columns into a second line under the legal name (proposal).

#### Query matching (M1 AC2 to AC4, AC18)

- The top bar search field carries the query; the page has no second text input (proposal).
- Case and diacritics ignored ("comerciala" finds "UniCredit Bank GmbH"); partial words from 2 characters; matches legal names and aliases. The row shows "Matched alias: <alias>" when an alias matched.
- Full 20-character LEI: that entity first. Partial LEI from 4 characters, prefix match, case-insensitive.
- BIC8 matches every BIC11 starting with it; BIC11 exact.
- Contract IDs match: a group master agreement ID opens the Group record that holds it; an entity contract ID opens that entity. A single exact contract ID hit navigates directly.
- Implementation: PostgreSQL `unaccent` + `pg_trgm` on a normalised search column (legal name and aliases), plus exact and prefix indexes on LEI, BIC and contract ID.

#### Filter panel (M1 AC5 to AC7; M5 AC16). AND across types, OR inside one type

| Filter | Control | Values |
|---|---|---|
| "Country" | Searchable multi-select | ISO 3166-1 alpha-2 (DE, GB, RO...) |
| "Scheme" | Checkbox list | EU VoP, UK CoP, Global validation (scheme tag styles) |
| "Role" | Radio list | "Customer" (includes entities that also hold the Partner role), "Network partner" (includes entities that also hold the Customer role), "Both" (only entities with both roles) |
| "Onboarding stage" | Checkbox list | Contract signed, Kickoff, Sandbox & technical integration, Testing & certification, UAT, Go-live approval, Live & hypercare, Ramp-up, BAU |
| "Partner coverage status" | Checkbox list | Onboarding, Active, Degraded, Suspended, Retired. Retired coverage rows excluded unless Retired is ticked |
| "Lifecycle state" | Checkbox list | Onboarding, Live, BAU, Inactive. Default: all except Inactive |
| "Current owner" | Searchable user picker grouped by team, with "No owner" first | Any portal user, shown "Emma Wilson, Customer Success" |

Stage, country and scheme filters must match on the same product line (customer side) or the same coverage row (partner side): an entity with EU VoP in IT and UK CoP in GB does not match Country = IT with Scheme = UK CoP. Cancelled product lines never match.

#### Result row (M1 AC6, AC8, edge case 5; M5 AC16)

| Column | Content |
|---|---|
| Legal name | Link to `/entities/[id]` (Overview) |
| Matched alias | "Matched alias: MPS" (only when an alias matched) |
| Type | Bank, Fintech or PSP |
| Country | ISO alpha-2 |
| LEI + status | LEI in DM Mono + chip ("Issued", "LEI lapsed", "Not verified with GLEIF", or the invalid status) |
| Roles | Chips "Customer", "Network partner" |
| Group | Group name linked to `/groups/[id]`, or "Standalone entity" |
| Current owner | "Emma Wilson, Customer Success" or "No owner" (warning style) |
| Lifecycle state | Chip Onboarding, Live, BAU or "Inactive" |
| Match reason (only with country or scheme filters) | "Customer product" and/or "Partner coverage" with the pair's coverage status, for example "Partner coverage: GB / UK CoP Degraded since 02 Oct 2026". A dual-role entity matching on both shows one row with both chips |
| Warning (partners) | "No active incident contact" (danger chip) when the partner has none |

#### Sort (M1 AC9)

"Relevance" (default with a query): exact LEI or BIC, then exact name or alias, then partial; ties alphabetical by legal name. Other options: "Legal name", "Country", "Lifecycle state". With no query the default is "Legal name" (proposal).

#### Obligations view (M13 AC9 to AC13; resolution 25)

- Switching keeps every M1 filter (country, scheme, role, stage, partner coverage status, owner, lifecycle) and adds "Subprocessor notice (days)" min/max and "Incident notice (hours)" min/max. Each numeric filter has the checkbox "Only rows where this is not captured"; ticking it disables that filter's min and max.
- Rows: one per obligation set; an entity with both roles has two rows (Customer and Partner). Soft-deleted entities excluded (M16 AC10).
- Columns: "Entity" (link to the Compliance tab card, proposal), "Country", "Role" (Customer / Partner), "Incident notice (h)", "Subprocessor notice (d)", "Audit right", "SLA %", "EU VoP", "UK CoP", "Expiry" (with "Expired" or "Expires in N days" chip when 90 days or less), "Contract link" (opens in a new tab).
- Filter rules in this view: Scheme matches the scheme status fields on the obligations card: scheme = UK CoP returns rows whose UK CoP status is anything other than "Not applicable". Country matches the country of the entity's product line for Customer rows and the country of a coverage row for Partner rows (proposal for partner rows). "Partner coverage status" returns Partner rows of entities with at least one coverage row in that status. Rows with an empty value in an active numeric filter are excluded.
- Display: incident notice "2 h"; subprocessor notice 0 shows "No advance notice required"; empty values "Not captured".
- Sort: Incident notice and Subprocessor notice sort ascending and descending; empty values always last. Default sort Subprocessor notice, descending.
- Count updates with every filter change: "14 agreements".

#### Actions

| Action | Who | Result | ACs |
|---|---|---|---|
| Search by text | All 6 teams | Ranked results | M1 AC2 to AC4, AC9 |
| Apply filters without text | All 6 teams | Every non-deleted entity matching | M1 AC5, AC7 |
| Filter by country + scheme (+ Network partner role) | All 6 teams | Customers and partners for the pair, each row labelled | M1 AC6; M5 AC16 |
| Sort | All 6 teams | Re-ordered list | M1 AC9 |
| Open a result | All 6 teams | Entity record, Overview, shareable URL | M1 AC11 |
| Open the group from a row | All 6 teams | Group record | M1 AC8 |
| Search by contract ID | All 6 teams | Group record or entity that holds the contract | M1 AC18 |
| "New customer" from the no-match state | Sales only | Wizard step 1 with `?name=<query>` pre-filling Legal name | M1 states; M2 AC1 |
| Switch to Obligations and filter by notice | All 6 teams can view (Compliance primary) | One row per obligation set | M13 AC9 to AC13 |

#### States

| State | Copy |
|---|---|
| Empty (no query, no filters) | Filter panel visible; results area "Search by name, alias, LEI or BIC, or use filters." |
| No results (query) | "No institutions match '<query>'" with "Clear filters". Sales users also see the button "New customer" (opens the wizard with the name pre-filled) |
| No results (filters only) | "No institutions match these filters" with "Clear filters" (proposal) |
| Loading | Skeleton result rows; the search box keeps the typed text and stays editable; filters stay usable |
| Error | "Search is unavailable right now. Try again." with "Retry"; query and filters kept |
| Inactive entities | Hidden by the default lifecycle filter; shown with the "Inactive" chip when Inactive is ticked |
| Soft-deleted entities | Never shown, for any team including the admin (the admin uses Admin > Deleted records) |
| Obligations empty | "No agreements match these filters" with "Clear filters" |
| Obligations load error | "Couldn't load obligations. Retry" |
| Read-only | No editable data; rows are links |

#### Worked examples (seed; use as tests)

- "Financial Services": "Adyen N.V." (legal name) and "Zopa Bank Limited" with "Matched alias: Zopa Financial Services". "mps": Banca Monte dei Paschi di Siena S.p.A. with "Matched alias: MPS".
- "Santander": 4 rows in the seed (Santander UK plc, Banco Santander Totta, S.A., Santander Consumer Bank S.p.A., Banco Santander Consumer Portugal S.A.), 5 after scenario 1, all with group "Santander". Banco Santander S.A. has no entity record and never appears as a row.
- "RNCBROBU": UniCredit Bank GmbH (HYVEDEMMXXX).
- "IPE-MSA-2026-014": opens the Santander Group record.
- "Lloyds": one row, Lloyds Bank plc, roles "Customer", "Network partner". "Lloyds TSB": same row with "Matched alias: Lloyds TSB Bank plc".
- Country = GB, Scheme = UK CoP: customer rows "Customer product", partner rows "Partner coverage: GB / UK CoP <status>"; Lloyds Bank plc shows both chips on one row. Monzo Bank Ltd is absent.
- Country = GB + Scheme = EU VoP: empty state when nothing matches both.
- Obligations, Country = GB, Scheme = UK CoP, Role = Customer, sort Incident notice ascending: Revolut Ltd 2 h, Santander UK plc 4 h, Lloyds Bank plc 8 h, Zopa Bank Limited "Not captured" last.

**ACs covered:** M1 AC1 to AC11, AC16 to AC19, all M1 states, edge cases 1 to 3, 5, 6; M5 AC16; M13 AC9 to AC13, list states, edge cases 1, 4; M16 AC10; M2 AC1 (entry).

---

### 5.5 New customer wizard (S3)

**Release:** R1 with steps 1 to 4, GLEIF lookup with cache, LEI status warnings (invalid statuses and "GLEIF unavailable" block Next), group suggestion, duplicate panel and submit; R2 adds the discard dialog, country override, invalid-status override and successor LEI, create group from GLEIF parent, "Add Customer role to this existing entity", "Contracted entities not yet in the portal" and manual entry.

- **Route:** `/customers/new`. Optional `?name=<text>` pre-fills Legal name (from the Search no-match state). "Add Customer role" mode is a client state switch inside the same route (no new URL).
- **Purpose:** Sales creates the customer record at deal close in 4 steps and hands it to a named Onboarding Manager in one submit.
- **Who:** Sales only (Tom Hadley, Michael Reed). Every other team gets the "Only Sales can create a customer record" page (S0) with link "Go to search" (M2 AC1, M15 edge case 5).
- **Entry points:** "New customer" on Home (Sales); "New customer" on the Search no-match state (Sales, name pre-filled); "Add Customer role to this existing entity" in the duplicate panel; direct URL.
- **Demo priority:** P1.

#### Layout regions

1. Shell (S0).
2. **Wizard header:** title "New customer" (in Add Customer role mode: "Add Customer role: <legal name>", proposal); "Cancel" text button on the right that opens the discard dialog.
3. **Stepper** (5.1.6) under the title: 1 "Entity and LEI", 2 "Products, countries and commercial terms", 3 "Initial contacts", 4 "Handoff summary and Onboarding Manager".
4. **Step body:** single column of cards, max width 960px, left aligned. Step 1 adds a 360px right column for the duplicate panel when matches exist.
5. **Sticky footer bar:** "Back" (secondary, left; from step 2), "Next" or "Create customer and hand over" (primary `lg`, right). Disabled "Next" has the tooltip "Complete the required fields on this step".

**At 1024px:** stepper labels shorten to "1 Entity", "2 Products", "3 Contacts", "4 Handoff"; the duplicate panel moves inline above the form; step 2 tables keep all columns and scroll inside their card.

#### Stepper and navigation rules

- "Next" is disabled until every required field on the step is valid and no blocking error shows. On step 1 it is also disabled while the GLEIF lookup runs.
- "Back" keeps every value entered on later steps.
- Completed steps and the current step are clickable; unreached steps are not.
- Editing step 1 after reaching later steps re-runs the duplicate check. If an earlier step becomes invalid it shows Has errors; "Next" on later steps stays available; "Create customer and hand over" stays disabled until every step is valid.
- **No drafts.** Nothing is stored until the step 4 submit. Wizard state lives client-side only (React state, validated with the same Zod schemas the server uses).
- **Leaving:** "Cancel", any navigation link, the global search, "View as" and browser back open the dialog: title "Discard this new customer?", body "Nothing has been saved.", buttons "Discard" (destructive) and "Keep editing" (secondary). Closing the tab or reloading triggers the browser's native leave warning (`beforeunload`). "Discard" drops all wizard data.

#### Step 1. Entity and LEI (M2)

Field order: LEI (focused on open), Legal name, Country, Type, Group, BICs, Aliases.

**Card "Legal entity"**

| Field | Control | Rule | Copy | ACs |
|---|---|---|---|---|
| LEI | Text input, DM Mono, "Look up" button inside the field on the right | Required. Trimmed, uppercased on input. Exactly 20 chars A-Z 0-9; last 2 pass ISO 7064 MOD 97-10 | Helper "Enter the LEI to fill the legal data from GLEIF". Invalid: "LEI must be 20 letters or digits and pass the ISO 17442 check" (no lookup runs) | M2 AC2, AC3 |
| Legal name | Text input | Required. Filled from GLEIF with tag "From GLEIF, <date> <HH:MM>" (for example "From GLEIF, 02 Oct 2026 10:14") | "Enter the legal name" | M2 AC2, AC5 |
| Type | Segmented: Bank, Fintech, PSP | Required | "Select the entity type" | M2 AC2 |
| Country | Searchable select, shown "AT Austria" | Required. Filled from the GLEIF legal address country when empty | "Select the country" | M2 AC2, AC6 |
| Group | Searchable select of existing groups + fixed options "Standalone entity" and (when GLEIF returns a parent with no portal group) "Create group from GLEIF parent" | Optional | See group rules | M2 AC2, AC8 |
| BICs | Multi-value chip input, DM Mono | Optional. Uppercased. 8 or 11 chars: 4 letters, valid ISO country code, 2 letters or digits, optional 3 letters or digits | Invalid (blocks Next): "BIC must be 8 or 11 characters (e.g. ABBYGB2L or ABBYGB2LXXX)". Country mismatch (warning, non-blocking): "BIC country code <XX> differs from the entity country <YY>" | M2 AC2, AC4 |
| Aliases | Multi-value chip input | Optional, max 100 chars each | "Alias must be 100 characters or fewer" | M2 AC2 |

**Card "GLEIF record"** (after a lookup; read-only; every value tagged "From GLEIF"): legal name, legal address country, LEI registration status (chip), next renewal date, direct parent (LEI and legal name), ultimate parent (LEI and legal name), lookup time.

**GLEIF lookup (M2 AC5):**
- Runs on blur of a valid LEI or on "Look up". During the call: spinner inside the LEI field with "Looking up GLEIF...", "Next" disabled.
- Calls the live API `https://api.gleif.org/api/v1/lei-records/<LEI>` plus the direct and ultimate parent relationship endpoints, server-side. Timeout 5 seconds.
- When GLEIF is unreachable and the LEI is in the cached demo set, the cached copy answers and the tag reads "From GLEIF (cached copy, <date>)". Any other LEI goes to the GLEIF unavailable state.

**LEI status banner (M2 AC7), directly under the LEI field**

| GLEIF status | Banner | Style | Continue |
|---|---|---|---|
| ISSUED | none; chip "Issued" | success chip | Yes |
| LAPSED | "LEI lapsed on <date>" | warning | Yes. After creation the entity shows "LEI lapsed" and appears on the Compliance worklist as Overdue |
| RETIRED, MERGED, ANNULLED, DUPLICATE | "This LEI is no longer valid for this entity" plus the status ("Retired", "Merged", "Annulled", "Duplicate") | danger | If GLEIF names a successor: button "Use successor LEI <LEI>" (replaces the LEI and re-runs the lookup). Otherwise, or to keep the LEI: required "Reason for using this LEI" (min 10 chars; error "Reason must be at least 10 characters"); saved to History as "LEI status override: <reason>". "Next" disabled until the reason is valid or the successor is used |
| PENDING_TRANSFER | "LEI status: Pending transfer" | warning | Yes |
| PENDING_ARCHIVAL | "LEI status: Pending archival" | warning | Yes |

**GLEIF failure states**

| State | User sees | Next |
|---|---|---|
| GLEIF unavailable (timeout or server error, no cached copy) | Danger banner "GLEIF is unavailable. You can retry or enter the legal name and country manually." with "Retry lookup". Legal name and Country become editable without the "From GLEIF" tag | Enabled once legal name and country are entered. Saves with LEI status "Not verified with GLEIF"; Ops later sees "Retry GLEIF lookup" on the entity header |
| LEI not found | Danger banner "No GLEIF record for <LEI>. Check the LEI with the customer." Link "Enter details manually" opens Legal name, Country and a required reason (min 10 chars) | Blocked until the LEI is corrected or details are entered with a reason. Reason saved to History; LEI status "Not verified with GLEIF" |
| LEI format invalid | Field error "LEI must be 20 letters or digits and pass the ISO 17442 check" | Blocked |

**Country check (M2 AC6):** if the chosen country differs from GLEIF, the note "GLEIF records <XX> for this LEI" shows under Country (warning style) and the country switches to the GLEIF value. The user can switch it back; that override is audited.

**Group rules (M2 AC8):**
- GLEIF ultimate parent LEI matches a portal group's parent LEI: that group is pre-selected with the tag "Suggested from GLEIF parent". The match uses the ultimate parent (Santander Consumer Bank S.p.A., direct parent Open Bank S.A., lands in "Santander").
- GLEIF parent matches no group: option "Create group from GLEIF parent", showing the parent's legal name, LEI and HQ country. The group is created at submit in the same transaction; a discarded wizard leaves no group. Creation is audited.
- User picks a group whose parent LEI differs from the GLEIF parent: warning (non-blocking) "This group's parent LEI is <LEI> (<name>). GLEIF reports <LEI> (<name>)".
- No group and no GLEIF parent: field stays empty. "Standalone entity" is a deliberate choice; empty later shows "Group not set" on the Ops worklist.

**Duplicate warning panel (M2 AC9 to AC13)**
- Runs when the LEI lookup completes (so the panel appears as soon as GLEIF fills the legal name), when a BIC is added, and when the legal name or an alias changes. Compares against all entities including soft-deleted ones. Server endpoint, debounced 300ms.
- Rules: same LEI; any BIC with the same first 8 characters; legal name or alias equal after normalisation (lowercase, diacritics and punctuation removed, legal forms plc, SA, S.A., S.p.A., AG, Ltd, DAC, B.V., N.V., GmbH removed); otherwise trigram similarity of normalised names at 0.85 or higher (threshold in configuration).
- Panel title "Possible duplicates (<n>)", up to 5 match cards: match reason chip (LEI, BIC or Name), legal name, country, LEI, roles, current owner (name, team), lifecycle state, "Open record" (new tab).
- Soft-deleted match card: "A deleted record with this LEI exists. Ask the admin to reactivate it." with the deleted record's legal name and deletion date; no "Open record" for non-admins.
- **Continue despite the warning:** checkbox "I checked these records and this is a different legal entity" + required "Reason" (min 10 characters). While any match shows, "Next" stays disabled until both are set. Creation is never blocked by a duplicate. History on the new record: "Duplicate warning acknowledged: <reason>".
- **Existing partner entity (M2 AC13, resolution 29):** when the LEI match holds the Network partner role and no Customer role, the panel's main action is the primary button "Add Customer role to this existing entity". It switches to Add Customer role mode: step 1 shows the existing entity read-only with "Owned by Ops"; the duplicate checkbox and reason are skipped; steps 2 to 4 add the Customer role, products, contacts and handoff to that record; no new entity is created; the current owner stays unchanged until the pickup is confirmed.

#### Step 2. Products, countries and commercial terms (M3 AC1 to AC7)

**Card "Product lines"** (table; opens with one blank row)

| Column | Control | Rule | Error copy |
|---|---|---|---|
| Product or scheme | Select: EU VoP, UK CoP, Global validation (scheme tags) | Required | "Select a product" |
| Country | Searchable select ISO alpha-2 | Required. UK CoP: GB only. EU VoP: SEPA scheme area only. Global validation: any | "UK CoP is available only in GB" / "EU VoP is available only in SEPA countries" |
| Contracting entity | Select: the new entity (default) and every entity of the group chosen in step 1. Entities typed in "Contracted entities not yet in the portal" are not selectable | Required | |
| Target go-live | Date picker | Required, valid, not in the past | "Target go-live is in the past" (blocks Next) |
| Row action | "Remove" icon button, hidden when only one line exists | At least 1 line | |

- "Add product line" (secondary) under the table.
- Product + country + contracting entity unique within the customer; the second line shows "This product line already exists".
- **"Contracted entities not yet in the portal":** textarea, optional, max 1,000 characters with counter, placeholder "Legal name and LEI, one per line".

**Card "Commercial terms"** (once per customer; no ownership label inside the wizard)

| Field | Control | Rule | Error copy |
|---|---|---|---|
| Currency | Segmented: EUR, GBP, USD | Required | "Select a currency" |
| Price per verification | Decimal with currency prefix | Required, > 0, max 4 decimals | "Enter a price greater than 0 with up to 4 decimals" |
| Volume tiers | Optional rows: From volume, To volume, Price per verification; "Add tier" | Whole numbers; ascending, no overlap, no gaps; last "To" may be empty | Gap: "Tiers must be continuous" on the later tier. Overlap: "Tiers must not overlap" |
| Monthly minimum | Decimal with currency prefix | Optional, 0 or more | "Enter 0 or more" |
| Payment term (days) | Whole number | Required, 1 to 180 | "Enter a whole number from 1 to 180" |

**Card "Promised SLAs"** (optional): Availability % (90.00 to 100.00, 2 decimals), Maximum response time (ms, whole number > 0), "Other SLA commitments" (textarea, max 1,000).

**Card "Special terms"** (optional): textarea, max 2,000, placeholder "Pilot pricing for first 3 months in DE".

#### Step 3. Initial contacts (M3 AC8, M7)

- Context: Customer (selector hidden; a new entity has only the Customer role). In Add Customer role mode contacts are created in Customer context.
- Role dropdown offers only Champion and Decision maker. Helper under it: "Technical, incident and escalation contacts are added by Ops. Billing contacts are added by Finance."
- At least 1 Champion or Decision maker; until then "Next" is disabled and the card shows "Add at least one champion or decision maker to continue". Step 3 opens with one blank contact card. "Add contact" adds another.

| Field | Rule | Error copy |
|---|---|---|
| Role | Required: Champion or Decision maker | |
| Full name | Required, 2 to 120 chars | "Enter a name of 2 to 120 characters" |
| Email | Required, one `@`, domain with a dot, no spaces, max 254, stored lowercase | "Enter a valid email address" |
| Phone | Optional. Strip spaces, hyphens, dots, brackets, then E.164 | "Use international format, for example +447700900123" |
| Time zone | Optional, searchable IANA list | |
| Availability window | Optional. "24/7" or weekdays + start and end HH:MM; end before start means crossing midnight | |
| Job title | Optional, max 120 | |
| Status | Fixed to Active | |

- Last verified is set to the submit date with the Sales user as verifier.
- Same email entered twice: the second form offers "Copy details from <name> (<role>)". Same email and same role: "<name> is already an active <role> contact", confirm or cancel.

#### Step 4. Handoff summary and Onboarding Manager (M3 AC9, AC10)

- Read-only summary in 4 cards, each with an "Edit" link to its step: Entity (legal name, LEI and status chip, type, country, group, BICs, aliases, override reasons), Products (lines table), Commercial terms and SLAs (with special terms and contracted entities not yet in the portal), Initial contacts.
- "Notes for Onboarding": textarea, optional, max 2,000.
- "Onboarding Manager": required select of active Ops users, shown "Adrian Koh (Ops)", "Kevin Lim (Ops)". Empty list: "No active Onboarding Manager found. Contact the portal admin." and submit disabled.
- Primary button "Create customer and hand over". On click: spinner with "Creating customer...", all fields locked.
- **Submit (one transaction, M2 AC14, M3 AC10):** creates the group when "Create group from GLEIF parent" was chosen; the entity (lifecycle Onboarding, current owner = the Sales user, LEI status and lookup time stored); the Customer role with the handoff summary; the product lines (stage "Contract signed", stage entry date today); the contacts; a Handoff `Sales → Ops` with status Sent, sent date now and a snapshot of the summary. Audit entries per field set (old value "(none)") and for overrides and group creation (M2 AC17, M3 AC16). In Add Customer role mode the entity is updated, never created, and its owner stays unchanged.
- **Submit failure:** banner at the top of step 4 "The customer could not be created. Nothing was saved. Try again." All data stays in the wizard.

**Success (after submit):**
- The new entity record opens on Overview at its shareable URL.
- Toast "<legal name> created and handed over to <Onboarding Manager>", for example "Santander Consumer Bank GmbH created and handed over to Adrian Koh".
- Header shows "Owner: Tom Hadley, Sales" and the banner "Handoff to Adrian Koh pending since 02 Oct 2026" with links "View handoff" (S6) and, for Sales, "Change Onboarding Manager".
- History: "Record created by Tom Hadley (Sales)", "Handoff sent to Adrian Koh by Tom Hadley", one "Product line added: <product>, <country>, target go-live <date>" per line, plus "Duplicate warning acknowledged: <reason>" and "LEI status override: <reason>" when they apply.
- The handoff appears on the Onboarding Manager's Home under "To pick up".

#### Actions

| Action | Who | Result | ACs |
|---|---|---|---|
| Open the wizard | Sales | Step 1 | M2 AC1 |
| Open the wizard URL | Ops, CS, Network, Compliance, Finance | Access page | M2 AC1, M15 edge case 5 |
| Look up LEI | Sales | GLEIF fields filled, duplicate check run | M2 AC5, AC9 |
| Use successor LEI | Sales | LEI replaced, lookup re-run | M2 AC7 |
| Override country, invalid LEI status, duplicate | Sales | Continues; override and reason audited (and in History for status and duplicate) | M2 AC6, AC7, AC12, AC17 |
| Create group from GLEIF parent | Sales | Group created at submit | M2 AC8 |
| Add Customer role to existing partner entity | Sales | Wizard continues on that entity | M2 AC13 |
| Add product lines, terms, SLAs, special terms, contacts | Sales | Stored at submit | M3 AC1 to AC8 |
| Choose Onboarding Manager and submit | Sales | One transaction; Handoff Sent | M3 AC9, AC10 |
| Discard | Sales | Nothing saved | M2 AC15 |

#### States

| State | Copy |
|---|---|
| Empty step 1 | All blank, LEI focused, helper "Enter the LEI to fill the legal data from GLEIF" |
| Empty step 2 | One blank product line, empty commercial terms |
| Empty step 3 | One blank contact card; "Add at least one champion or decision maker to continue" |
| Loading GLEIF | Spinner in the LEI field, "Looking up GLEIF...", Next disabled |
| Loading step change or submit | Spinner on the primary button, fields locked |
| Validation error | Inline field errors; Next or submit disabled; stepper marks the step Has errors |
| GLEIF unavailable | "GLEIF is unavailable. You can retry or enter the legal name and country manually." |
| LEI not found | "No GLEIF record for <LEI>. Check the LEI with the customer." |
| LEI status warning | "LEI lapsed on <date>" / "This LEI is no longer valid for this entity" |
| Duplicates | Panel with up to 5 matches; "I checked these records and this is a different legal entity" |
| Deleted duplicate | "A deleted record with this LEI exists. Ask the admin to reactivate it." |
| No Ops users | "No active Onboarding Manager found. Contact the portal admin." |
| Submit failed | "The customer could not be created. Nothing was saved. Try again." |
| 403 mid-session | Toast "You can't edit this. Owned by Ops. Your team: Sales." |
| Access denied | "Only Sales can create a customer record" + "Go to search" |
| Discard dialog | "Discard this new customer?" / "Nothing has been saved." / "Discard" / "Keep editing" |
| Add Customer role mode | Title "Add Customer role: <legal name>", step 1 read-only |

**Key copy (buttons and tags):** "Look up", "Retry lookup", "Use successor LEI <LEI>", "Create group from GLEIF parent", "Add Customer role to this existing entity", "Open record", "Add product line", "Add tier", "Add contact", "Back", "Next", "Create customer and hand over", "Cancel"; tags "From GLEIF", "Suggested from GLEIF parent", "Not verified with GLEIF".

**Scenario 1 data to type:** LEI 5299000I7Y60A8273788 (Santander Consumer Bank GmbH, AT; group "Santander" suggested; duplicate by Name with Santander Consumer Bank S.p.A., IT, 549300O0YQXDOJB36Y73); products EU VoP / AT and Global validation / AT; contracting entity picker lists the new entity plus Santander UK plc, Banco Santander Totta, S.A., Santander Consumer Bank S.p.A., Banco Santander Consumer Portugal S.A.; champion Katharina Huber, Head of Payments, katharina.huber@scb-at.example, +436641234567, Europe/Vienna.

**ACs covered:** M2 AC1 to AC19 (AC16, AC17, AC19 as effects), M2 states, edge cases 1 to 6; M3 AC1 to AC10, AC13, AC16, AC17, states, edge cases 1, 2, 4, 5; M7 AC1 to AC4, AC12 (step 3); M15 AC3, edge case 5.

---

### 5.6 Handoff (S6)

**Release:** R1 with View A (Confirm pickup), View B (Ops → CS form and send) and View C (summary and Accept); R2 adds Change recipient, Decline, Cancel handoff and resend with prefill.

- **Routes:** `/handoffs/[id]` (Sales → Ops confirmation view and Ops → CS acceptance view, shareable); `/handoffs/new?entity=[id]` (Ops → CS form, Ops only). A non-Ops user opening the form URL lands on the entity Overview with the toast "You can't edit this. Owned by Ops. Your team: <Team>." (M15 AC10 pattern). If the entry rule is not met (no product at Ramp-up or BAU, or an Ops → CS handoff is already Sent), the form URL redirects to the entity record.
- **Purpose:** one screen per Handoff record where the receiver reads the structured summary and takes ownership.
- **Who:** Ops (named Onboarding Manager confirms Sales → Ops; any Ops user sends and cancels Ops → CS); CS (chosen CSM accepts or declines); Sales (views its handoff, changes the Onboarding Manager while Sent); Finance (reads the Sales → Ops summary for commercial terms, SLAs, special terms, M3 AC15); Network and Compliance read-only.
- **Entry points:** Home "To pick up", "Awaiting acceptance", "Handoff declined", "Awaiting pickup"; entity header "Hand over to Customer Success" and the pending banner; History handoff events (each links here); wizard success "View handoff".
- **Demo priority:** P1.

#### Layout regions

1. Shell (S0).
2. **Breadcrumb:** "<Entity legal name> / Handoff", linking to the entity record.
3. **Handoff header:** title "Handoff: <legal name>", type chip (`Sales → Ops` or `Ops → CS`), status chip, "From <name>, <team>", "To <name>, <team>", "Sent <date>, waiting <n> days" (Sales → Ops) or "Sent <date>, pending <n> days" (Ops → CS); for closed handoffs the closing date and actor. Days pending highlighted (due style) after 2 business days.
4. **Status banner** when relevant (pending, declined, cancelled, recipient no longer valid, closed).
5. **Main column (about 2/3):** summary sections as cards.
6. **Action panel (about 1/3, sticky):** the actions the current user may take with their required fields. Users without actions see a read-only "who can act" note.

**At 1024px:** the action panel moves under the header as a full-width card; summary cards stack below; tables scroll inside their card.

#### Statuses

| Type | Status | Chip | Meaning |
|---|---|---|---|
| Sales → Ops | Sent | `due` | Waiting for the named Onboarding Manager |
| Sales → Ops | Confirmed | `success` | Confirmed; owner changed |
| Ops → CS | Sent | `due` | Waiting for the chosen CSM |
| Ops → CS | Accepted | `success` | Accepted; owner changed |
| Ops → CS | Declined | `danger` | Declined with reason; owner stays Ops |
| Ops → CS | Cancelled | `neutral-outline` | Cancelled with reason |

Sales → Ops has no Decline and no Cancel.

#### View A. Sales → Ops pickup confirmation (M3)

Header example: "Handoff: Santander Consumer Bank GmbH", `Sales → Ops`, Sent, "From Tom Hadley, Sales", "To Adrian Koh, Ops", "Sent 02 Oct 2026, waiting 0 days".

Summary cards (read-only snapshot taken at submit; later record edits do not change it):
1. "Entity": legal name, LEI with status chip and "From GLEIF" lookup time (or "Not verified with GLEIF"), type, country, group, BICs, aliases, override reasons (duplicate, LEI status, country).
2. "Products": product or scheme, country, contracting entity, target go-live, current stage; earliest target go-live highlighted.
3. "Commercial terms and SLAs": currency, price per verification, volume tiers, monthly minimum, payment term; availability %, maximum response time, other SLA commitments; special terms; contracted entities not yet in the portal.
4. "Initial contacts": role, name, job title, email (`mailto:`), phone (`tel:`), Last verified.
5. "Notes for Onboarding": the step 4 text, or "No notes from Sales".

Action panel:
- **Named Onboarding Manager, status Sent:** primary "Confirm pickup". On confirm: status Confirmed with confirmation date now; owner changes from the Sales user to the Onboarding Manager; the item leaves "To pick up"; History "Handoff confirmed by <Onboarding Manager>" and "Owner changed from <Sales user> to <Onboarding Manager>"; audit for status and owner (M3 AC16, AC17). Toast "Pickup confirmed. You are now the owner of <legal name>." Then the entity record opens on Products & onboarding.
- **Sales sender, status Sent:** "Change Onboarding Manager" opens the dialog (same as the entity banner): title "Change Onboarding Manager", required select of active Ops users with the current recipient disabled, buttons "Change Onboarding Manager" (primary) and "Cancel". Result: item moves to the new recipient's "To pick up", banner updates, audited, History "Onboarding Manager changed from <old> to <new> by <Sales user>".
- **Pickup on a soft-deleted entity:** "Confirm pickup" fails with "This record was deleted. Contact the admin to reactivate it."; the handoff returns as Sent after reactivation.
- **Everyone else, or status Confirmed:** no buttons. Note "Only <recipient> can confirm this pickup." (while Sent).

#### View B. Ops → CS handoff form (M8, before send)

**Entry rules (M8 AC1, AC2, resolution 38):** "Hand over to Customer Success" shows on the entity record to every Ops user, whoever the owner is. Enabled when at least one customer product is at Ramp-up or BAU and no Ops → CS handoff is open; otherwise disabled with tooltip "Available when at least one product has completed hypercare". When an Ops → CS handoff with status Sent exists, the button is replaced by the banner "Handoff to <CSM> pending since <date>" and no second handoff can be created.

Sections (headings exact):
1. **"Product stages"** (auto, read-only): product and country, current stage, stage entry date, billable from date ("Not yet" when empty). Captured at send time.
2. **"Open blocks"** (auto): one row per open block: product, Blocked by (Customer, Corvane, Partner), reason, blocked since, plus a required "Handoff note" (max 300) per block. Empty: "No open blocks".
3. **"Commitments to the customer"**: repeatable rows: Description (required, 5 to 300 chars), Due date (optional); "Add commitment". Checkbox "No open commitments" disables and clears the rows. The section cannot be empty; error "Add a commitment or tick No open commitments".
4. **"Confirmed contacts"**: every active Customer-context contact: role, name, email, phone, Last verified, owner label. Ops-owned contacts (Technical, Incident, Escalation) each need the required "Confirmed" tick; ticks set Last verified = today inside the send transaction. Other-team contacts (Champion and Decision maker "Owned by Sales and Customer Success"; Billing "Owned by Finance") are read-only with their Last verified. No active Incident contact: blocking error "Add an active incident contact before handing over" with a link to the Contacts tab. No active Champion: warning "No active champion. The CSM will need to identify one" (send still allowed).

Action panel (Ops sender):
- "Receiving CSM": required searchable select of active Customer Success users.
- "Note for the CSM": optional, max 1,000.
- Primary "Send handoff": disabled while sections load and until every required item is valid. On send (M8 AC9): Handoff `Ops → CS` with from = sending Ops user, to = chosen CSM, snapshot of the 4 sections and the note, status Sent, sent date; the owner stays unchanged; the entity header shows the pending banner; History "Handoff to Customer Success sent to <CSM> by <Ops user>". Toast "Handoff sent to <CSM>".
- "Cancel" (text) leaves the form; confirm dialog "Discard this handoff? Nothing has been sent."

**Resend after a decline or cancel:** the form opens with block handoff notes, commitments and the note for the CSM prefilled from the last handoff; every "Confirmed" tick cleared; "Receiving CSM" empty.

#### View C. Ops → CS acceptance view (M8, after send)

Header example: "Handoff: Revolut Ltd", `Ops → CS`, Sent, "From Adrian Koh, Ops", "To Emma Wilson, Customer Success", "Sent 01 Oct 2026, pending 1 day".

Main column: the 4 sections from the snapshot, read-only, with block notes, commitments and contact confirmations (with confirmation date), plus "Note for the CSM". Later record changes do not alter it.

Action panel by user and status:

| User | Sent | Accepted | Declined | Cancelled |
|---|---|---|---|---|
| Chosen CSM, while in the CS team | "Accept" (primary), "Decline" (secondary) | none | none | none |
| Any Ops user | "Cancel handoff" (destructive-secondary) | none | "Hand over to Customer Success" link (prefilled new form) | "Hand over to Customer Success" link |
| Other CS users, a former CSM no longer in CS, Sales, Network, Compliance, Finance | read-only | read-only | read-only | read-only |

- **Accept (M8 AC11):** confirm dialog "Accept <legal name>? You become the owner." On confirm: status Accepted with acceptance date; owner becomes the CSM; Champion and Decision maker keep "Owned by Sales and Customer Success"; the item leaves the CSM's "To pick up" and the sender's "Awaiting acceptance". History "Handoff accepted by <CSM>. Owner: <Ops user> → <CSM>". Toast "Handoff accepted. You are now the owner of <legal name>."
- **Decline (M8 AC12):** dialog with required "Reason" (10 to 500 chars), buttons "Decline handoff" and "Back". On confirm: status Declined; owner unchanged; sender's Home "Handoff declined by <CSM>: <reason>"; "Hand over to Customer Success" available again. History "Handoff declined by <CSM>: <reason>".
- **Cancel handoff (M8 AC13, AC15):** dialog with required "Reason" (10 to 500 chars), buttons "Cancel handoff" and "Keep handoff". On confirm: status Cancelled; a new handoff is allowed. History "Handoff cancelled by <Ops user>: <reason>".
- **CSM leaves the CS team while Sent (resolution 37):** Accept and Decline disappear for that user at once; the sender sees "Recipient no longer in Customer Success"; an Ops user cancels and sends a new one.

#### Actions (server enforces; 403 for anything outside this table, M15 AC9)

| Action | Who | Result | ACs |
|---|---|---|---|
| View any handoff | All 6 teams | Read-only summary and status | M3 AC12, AC15; M8 AC15 |
| Confirm pickup | Ops, named recipient only | Confirmed, owner → Onboarding Manager | M3 AC12 |
| Change Onboarding Manager (while Sent) | Sales | New recipient's "To pick up", audited | M3 AC13, edge case 3 |
| Open the Ops → CS form | Ops, when a product is at Ramp-up or BAU and none is open | Form opens | M8 AC1 |
| Send handoff | Ops | Sent, pending banner | M8 AC9 |
| Confirm Ops-owned contacts | Ops | Last verified = today, in the send transaction | M8 AC6 |
| Cancel handoff | Any Ops user | Cancelled | M8 AC13, AC15 |
| Accept / Decline | Chosen CSM, while in CS | Accepted (owner → CSM) / Declined (reason to sender) | M8 AC11, AC12 |

Every action writes audit entries in the same transaction: object Handoff, field status (old, new), plus owner (old, new) on confirm and accept, user, team, timestamp (M3 AC16, M8 AC16). Owner changes from handoffs are handoff events in History, separate from M9 reassignment (M9 AC12).

#### States

| State | Copy |
|---|---|
| Empty "To pick up" (Ops / CS) | "Nothing to pick up. New customers from Sales appear here." / "Nothing to pick up. Handoffs from Ops appear here." |
| Empty open blocks | "No open blocks" |
| Loading | Skeleton of the summary sections; "Send handoff" disabled |
| Pending (entity header) | "Handoff to <Onboarding Manager> pending since <date>" / "Handoff to <CSM> pending since <date>" |
| Waiting long | Days pending highlighted after 2 business days; "Waiting <n> days" on the Home row |
| Blocked send | "Add an active incident contact before handing over" |
| No champion | "No active champion. The CSM will need to identify one" |
| Disabled entry | Tooltip "Available when at least one product has completed hypercare" |
| Send failed | Banner "Handoff not sent. Try again.", values kept, no record created |
| Accept, decline or confirm failed | Status stays Sent; "Action not saved" |
| Soft-deleted entity (action) | "This record was deleted. Contact the admin to reactivate it." |
| Soft-deleted entity (non-admin opens URL) | "This record was deleted on <date>. Contact the admin, Adrian Koh, if it should be restored."; handoff off both worklists; returns as Sent after reactivation |
| Recipient no longer in CS | Banner for the sender "Recipient no longer in Customer Success" |
| Declined (sender view) | Danger banner "Handoff declined by <CSM>: <reason>" |
| Cancelled | Neutral banner "Handoff cancelled by <Ops user>: <reason>" |
| Accepted / Confirmed | Success banner "Accepted by <CSM> on <date>" / "Pickup confirmed by <Onboarding Manager> on <date>" |
| Read-only | Summary and status, no action controls; note "Only <CSM> can accept or decline this handoff." |
| 403 mid-session | Toast "You can't edit this. Owned by Customer Success. Your team: Ops." and read-only re-render |

**Key copy:** buttons "Confirm pickup", "Change Onboarding Manager", "Hand over to Customer Success", "Add commitment", "Send handoff", "Accept", "Decline", "Cancel handoff", "Decline handoff", "Keep handoff", "Back"; field labels "Receiving CSM", "Note for the CSM", "Handoff note", "No open commitments", "Confirmed".

**ACs covered:** M3 AC11 to AC13, AC15 to AC18, states, edge case 3; M8 AC1 to AC17, states, edge cases 1 to 5; M9 AC12; M11 AC5, AC10; M15 AC3, AC9, AC10; M16 AC10, AC13.

---

#### Conflicts resolved (section 5, part 1)

- Top bar colour: brand guide lists the dark forest for the top bar; the screen spec puts the dark colour on the demo strip and keeps the top bar white. Followed the screen spec (higher authority).
- AC numbers: the screen spec cites older numbers; this section uses Appendix A numbering (Roles & permissions = M15 AC13, Reset demo data = M16 AC16, contract ID search = M1 AC18, result count and URL state = M1 AC19, Awaiting pickup = M11 AC24, rows read-only = M11 AC25).
- Scenario 1 duplicate panel: the scenario script shows it after adding an alias; scenario decision 2 and M2 AC9 make it appear as soon as the GLEIF lookup completes. Followed the decision.
- Obligations filters: added M13 AC10 (UK CoP scheme = status other than "Not applicable"; coverage status returns Partner rows) and scenario decision 4 (country matches the product line country), which the screen spec does not state.
- Muted chip (Retired, Inactive): the screen spec gives 38% text, which fails contrast; muted chips use 60% text with a dashed border.
- Link blue #118AB2 fails 4.5:1 as text; added `--color-link-text: #0B6E8E` for text links and kept the brand token for icons and rules.
- Entity tab URL slugs and `/handoffs/new?entity=[id]` follow decision B5 (section 1.6); every section uses the same routes.


---

## 6. UI screens (part 2): entity record, group record, admin

Conventions used in this section:
- "Owned by <Team>" labels are exactly: "Owned by Sales", "Owned by Ops", "Owned by Customer Success", "Owned by Network", "Owned by Compliance", "Owned by Finance", plus "Owned by Sales and Customer Success" (Champion and Decision maker contacts, Customer context, always) and "Owned by Sales and Finance" (commercial terms).
- **Read-only rendering (M15 AC7, AC8), applies to every tab:** a section the viewer cannot edit renders as plain text with a lock icon and "Owned by <Team>" in the section header. Edit, Add and Delete controls are not rendered (never shown disabled). Values stay selectable. With mixed ownership inside a tab, the label sits per section or per field group.
- **403 mid-session (M15 AC10), applies to every save:** server returns 403 `{"error":"forbidden","owner_team":"<Team>"}`; UI shows toast "You can't edit this. Owned by <Team>. Your team: <Team>.", discards unsaved values for that section and re-renders it read-only.
- **Soft-deleted entity (M16 AC11), applies to every tab:** non-admins see only "This record was deleted on <dd Mon yyyy>. Contact the admin, Adrian Koh, if it should be restored." with no header data and no tabs. The admin sees the full record read-only under the red banner; every edit, Add note, Reassign and Hand over control is hidden.
- Dates display as `02 Oct 2026`; timestamps as `02 Oct 2026 10:05 (UTC+03:00)` (stored UTC, shown in viewer's local time with offset).
- "(proposal)" in the source is dropped here: everything below is the spec to build.
- Scheme tag colours: EU VoP `#003399`, UK CoP `#004225`, Global validation neutral.
- Every write goes through the service layer (one audit entry per changed field, same transaction) and is permission-checked on the server against the M15 AC3 matrix (reproduced in 6.12.3).

---

### 6.1 Entity record frame and header (S4.0)

**Release:** R1 with every header attribute, partner incident block, owner block, "Reassign owner", pending banners, billing badge, "Hand over to Customer Success", "Delete record" and the deleted-record banner and page; R2 adds the assignment banner with Acknowledge, "Change Onboarding Manager" and "Retry GLEIF lookup".

**Routes**
| Route | Behaviour |
|---|---|
| `/entities/{id}` | Redirects to `/entities/{id}/overview` (M1 AC11) |
| `/entities/{id}/{tab}` | `tab` ∈ `overview`, `details`, `products`, `contacts`, `history`, `partner`, `compliance`, `billing`, `audit`, and `issues` with the issue flow (6.13). Shareable |
| `/entities/{id}/products` on a partner-only entity | Opens Overview |
| `/entities/{id}/partner` on an entity without Network partner role | Opens Overview |
| `/entities/{id}/audit` for a non-permitted user | S0 access page "The audit log is visible to Compliance and the admin." API `GET /api/entities/{id}/audit` returns 403 (M16 AC4) |
| Unknown id | "We couldn't find that page. Search for a customer or go to Home." |

**Purpose:** identify the legal entity, show owner and state, and surface the incident contact and flags every team must see before reading a tab.

**Entry points:** search result (M1 AC11), worklist "Open" link (M11 AC4), group record row (M4 AC1), "Open record" in the duplicate warning (M2 AC11), shared URL, "Other entities in this group" on Overview.

**Frame:** S0 app shell, then header, tab bar, tab body. Desktop first at 1280px minimum. Tab content area: max width 1200px, 24px padding, cards with 8px radius and 1px `--color-border`. At 1024px: header reflows to two rows, attribute row wraps, header actions collapse into "More" except the single primary action for the current team, the incident contact block keeps full width under the name, tab bar scrolls horizontally, tables scroll horizontally inside their card.

**Header layout (top to bottom)**
1. Banner strip, only when a condition applies, stacked in this priority: soft-deleted (admin only), owner assignment, pending handoff, handoff recipient warning.
2. Identity row: legal name (page title, 24px, weight 600) with "Inactive" badge (muted grey pill) when lifecycle state is Inactive (M1 AC10). Aliases are not shown in the header. Right side: header actions, then "More" menu.
3. Incident contact block, partner entities only, directly under the legal name (M7 AC10).
4. Attribute row.
5. Tab bar.

**Incident contact block** (card, `--color-tint-strong` background, 8px radius). Shown only when the entity has the Network partner role (M1 AC13). Source: primary active Incident contact in the Partner context; if none is Primary, the most recently verified active one (M7 AC9). On a dual-role entity it shows the Partner-context contact only (M7 edge case 4).
| Field | Content (example Lloyds Bank plc) |
|---|---|
| Label | "Incident contact" + chip "Primary" |
| Name, job title | Paul Grant, Head of CoP Service Operations |
| Phone | `+447700900123` as `tel:` link + copy icon button (tooltip "Copy phone number", toast "Phone number copied") |
| Email | `mailto:` link |
| Time zone, local time | "Europe/London", "Local time 13:12" |
| Availability | "24/7" or window, plus chip "Available now" (green) or "Outside availability" (mahogany) |
| Last verified | "Verified 20 days ago by Lukas Brenner" |
| Link | "All incident and escalation contacts" → Contacts tab filtered to Incident + Escalation, Partner context |
Empty: carmine critical style, "No active incident contact" (none ever recorded or last one marked left; M7 AC8, resolution 42). Error: "Incident contact unavailable. Retry." Loading: this block's skeleton loads first on partner records.

**Attribute row**
| Element | Content |
|---|---|
| LEI | DM Mono, copy icon. Status badge: "ISSUED" (green); "LEI lapsed" (mahogany, M2 AC7); "PENDING_TRANSFER", "PENDING_ARCHIVAL" (mahogany); "RETIRED", "MERGED", "ANNULLED", "DUPLICATE" (carmine); "Not verified with GLEIF" (grey). Tooltip "GLEIF status, checked 02 Oct 2026 09:14" |
| Type | Bank, Fintech or PSP |
| Country | "GB, United Kingdom" |
| Group | Link to group record (e.g. "Santander"); "Standalone entity" (plain text); "Group not set" (mahogany text, M4 AC15) |
| Role chips | "Customer", "Network partner". Partner chip has a warning dot when any coverage row is Degraded or Suspended, tooltip "Partner coverage issue: GB / UK CoP Degraded since 02 Oct 2026" (M5 AC12). Clicking "Network partner" opens Partner tab |
| Owner block | "Owner: <name>, <team>" + "Owner since 14 Sep 2026" (M9 AC1, resolution 43). "Inactive user" label if owner account is deactivated (rule only; no inactive users in seed). No owner: warning style "No owner" (M9 AC2) |
| Reassign control | CS: secondary button "Reassign owner" ("Set owner" when no owner). Everyone else (including admin): lock icon in its place, tooltip "Owned by Customer Success" (M9 AC3) |
| Lifecycle chip | Onboarding (neutral), Live (green), BAU (forest teal), Inactive (muted). Computed per M6 AC12 (partner-only entities per decision B1) except Inactive |
| Billing flag | "Incomplete for billing" amber pill (`--color-due-soon`), every team. Tooltip lists gaps, e.g. "Missing: VAT / tax ID, Contract reference. Invalid format: LEI". Click → Billing tab (M14 AC9). Never rendered before the billing profile has loaded |

**Banners**
| Banner | Condition | Copy | Actions |
|---|---|---|---|
| Sales → Ops pending | Handoff `SALES_TO_OPS` status Sent | "Handoff to <recipient> pending since <date>" (M3 AC13) | "Open handoff" (screen 6). Sales: "Change Onboarding Manager" (dialog from S6 View A, resolution 36). Named Onboarding Manager: "Confirm pickup" on screen 6 |
| Ops → CS pending | Handoff `OPS_TO_CS` status Sent | "Handoff to <recipient> pending since <date>" (M8 AC2). Replaces the "Hand over to Customer Success" button | "Open handoff" |
| Recipient lost CS role | Ops → CS Sent and recipient no longer CS; shown to sender | "Recipient no longer in Customer Success" (M8 edge case 2) | "Open handoff" (to cancel) |
| Owner assignment | Viewer has an unacknowledged M9 assignment on this entity | "You were assigned as owner on <date> by <actor>: <reason>" e.g. "You were assigned as owner on 02 Oct 2026 by Emma Wilson: Leo on parental leave until February 2027" (M9 AC10) | "Acknowledge" |
| Soft-deleted | Entity deleted, viewer is admin | Red: "Deleted by <user> on <date>. Reason: <reason>" (M16 AC11) | "Reactivate" |

**Header actions** (rendered only for permitted users)
| Control | Who | Placement and rule |
|---|---|---|
| "Reassign owner" / "Set owner" | CS only (admin excluded) | Secondary button next to owner block |
| "Hand over to Customer Success" | Any Ops user, whoever the owner is (resolution 38) | Primary button in identity row. Disabled unless a Customer product line is at Ramp-up or BAU, tooltip "Available when at least one product has completed hypercare". Replaced by the pending banner while an Ops → CS handoff is open. Opens screen 6 |
| "Retry GLEIF lookup" | Ops | Secondary button next to LEI badge, only when status is "Not verified with GLEIF". Calls GLEIF, updates status and lookup time |
| "More" → "Delete record" | Admin only (M16 AC8; API 403 for others) | Opens Delete dialog. Entity data edits live on Details tab; header has no edit panel |

**Reassign owner dialog** (M9 AC5 to AC7). Modal 520px, backdrop `#041F1FE6`.
| Element | Spec |
|---|---|
| Title | "Reassign owner" or "Set owner" |
| Current owner | Read-only "Leo Martin, Customer Success"; omitted for Set owner |
| New owner | Required. Searchable picker of active users from Customer Success, Ops / Onboarding, Sales, grouped by team, CS first. Inactive users never listed. Picker errors: "Could not load users" + "Retry"; "No active users match" |
| Reason | Required textarea, 10 to 500 chars, counter "0 / 500", placeholder "Why is the owner changing? For example: on leave until February 2027" |
| Effective date | Read-only, today |
| Pending handoff warning | Amber inline, when an Ops → CS handoff is Sent: "A handoff to <name> is awaiting acceptance. If <first name> accepts, he becomes owner." (M9 edge case 3) |
| Buttons | "Cancel" (secondary), "Reassign" (primary; "Set owner" in Set variant). Spinner + disabled while saving |
| Validation | Same owner selected: "Reassign" disabled, message "Select a different owner". Reason missing or < 10 on click: "Reason is required (minimum 10 characters)" |
| Success | Close, header updates, toast "Owner changed to <name>" (M9 AC7). Audit entry; History event "Owner reassigned"; worklist item "Ownership assigned to you" for new owner. Self-assignment allowed, creates no worklist item (M9 edge case 4) |
| Errors | Concurrent: "Owner was changed by <name> at <HH:MM>. Reload to see the current owner." (M9 edge case 1). Failure: dialog stays open, values kept, "Could not reassign owner. Try again." |

**Acknowledge** (assigned owner): banner closes, worklist item leaves, badge count drops by one, audit entry (M9 AC10).

**Delete record dialog** (admin, M16 AC9)
- Title "Delete <legal name>?"
- Body "The record and all its data are hidden from search, worklists and group lists. You can reactivate it from Admin > Deleted records."
- Reason required, 10 to 500 chars, counter. Buttons "Cancel", "Delete" (carmine fill, disabled until reason valid).
- On confirm: deleted marker with deleted by, deleted at, reason; audit "Record status · Active · Deleted" with reason. Success toast links to Admin > Deleted records. Failure: "Action not completed. Try again." record unchanged.

**Reactivate confirmation** (admin, M16 AC13): "Reactivate <legal name>? All its data returns to search and worklists." Buttons "Cancel", "Reactivate". LEI-conflict variant: see 6.12.2.

**Tab bar.** Order: Overview, Details, Products & onboarding, Contacts, History, Issues (issue flow, 6.13), Partner, Compliance, Billing, Audit. Active tab: `--color-selected` background + forest teal underline. E = edit, R = read.
| Tab (key) | Sales | Ops | CS | Network | Compliance | Finance | Visibility rule |
|---|---|---|---|---|---|---|---|
| Overview (`overview`) | R | R | R | R | R | R | Always; read-only for all (M1 AC15) |
| Details (`details`) | E handoff summary, commercial terms | E entity core, roles, contract ref, partner agreement ref, lifecycle (Inactive) | E renewal date | R | R | E commercial terms | Always (M1 AC20) |
| Products & onboarding (`products`) | R + edit product lines and target go-live | E | R | R | R | R | Hidden when entity has no Customer role (resolution 46) |
| Contacts (`contacts`) | E Champion, Decision maker (Customer) | E Technical, Incident, Escalation (Customer) | E Champion, Decision maker (Customer) | E Partner context, all roles except Billing | R | E Billing (both contexts) | Always |
| History (`history`) | add notes | add notes | add notes | add notes | add notes | add notes | Always |
| Issues (`issues`, issue flow) | add (report, notes) | add (report, notes) | add (report, notes) | add (report, notes) | add (report, notes) | add (report, notes) | Always; issue edits happen on the Issue page by role (6.13) |
| Partner (`partner`) | R | R | R | E | R | R | Only with Network partner role (M5 AC1) |
| Compliance (`compliance`) | R | R | R | R | E | R | Always |
| Billing (`billing`) | R | R | R | R | R | E | Always |
| Audit (`audit`) | hidden | hidden; visible to the admin (Adrian Koh) | hidden | hidden | R | hidden | M16 AC4 |

"View as" switch re-renders the tab bar immediately (M15 AC11). If the current tab is not visible to the new user: open Home with toast "You don't have access to that page as <team>" (resolution 59).

**Header states**
| State | UI | Copy |
|---|---|---|
| Loading | Skeleton for name, attribute row, owner block; incident block skeleton first on partners; billing badge hidden until profile loads | none |
| Error (record) | Header and tabs replaced by error panel with "Retry" | "This record could not be loaded. Try again." |
| No owner | Owner block warning style; CS sees "Set owner" | "No owner" |
| Read-only | Non-permitted controls absent; lock icon instead of Reassign | tooltip "Owned by Customer Success" |
| Pending handoff | Banner; owner stays the sender until confirmation or acceptance | banner copy |
| Soft-deleted, non-admin | No header data, no tabs | "This record was deleted on <date>. Contact the admin, Adrian Koh, if it should be restored." |
| Soft-deleted, admin | Full record read-only, red banner + "Reactivate"; Reassign, Hand over, Add note, all edits hidden | banner copy |
| Inactive | "Inactive" badge; record stays editable per M15 | "Inactive" |
| Owner inactive | Name + "Inactive user"; Reassign stays for CS | "Inactive user" |
| 403 mid-session | Toast + read-only re-render | "You can't edit this. Owned by Customer Success. Your team: Network." |
| Delete/reactivate failed | Record unchanged | "Action not completed. Try again." |

**ACs:** M1 AC10 to AC13, AC16, edge cases 2, 5; M2 AC7, error state; M3 AC13, edge case 3; M5 AC12; M7 AC8 to AC10, edge cases 1, 4, states; M8 AC1, AC2, edge case 2; M9 AC1 to AC12, edge cases 1 to 5; M14 AC9, AC10, loading state; M15 AC7, AC10 to AC12; M16 AC8, AC9, AC11, AC13.

---

### 6.2 Overview tab (S4.1), key `overview`

**Release:** R1 (complete, read-only).

**Purpose:** one-page read-only summary any team can answer from. **No edit controls for any team** (M1 AC15).

**Layout:** two columns at 1280px. Left (2/3): Active alerts, Products and stages, Latest interactions. Right (1/3): Roles, Key people, Current owner, Other entities in this group (only when grouped). At 1024px single column: Active alerts, Products and stages, Roles, Key people, Latest interactions, Current owner, Other entities in this group. Each section is a card with title and a "View in <tab name>" link in the card header. Sections load independently.

**Active alerts** (same for every team). Each row: severity icon, text, link to the tab where it is resolved; clicking opens that tab and scrolls to the item. Sort: carmine first, then mahogany, then soonest date.
| Alert | Severity | Copy pattern | Opens |
|---|---|---|---|
| Blocked product | Carmine | "UK CoP / GB blocked by Partner since 24 Sep 2026: partner bank sandbox unavailable" | Products & onboarding |
| No active incident contact | Carmine | "No active incident contact" | Contacts |
| LEI lapsed or invalid | Carmine | "LEI lapsed" | Compliance |
| KYB expired | Carmine | "Licence expired on 01 Sep 2026" | Compliance |
| Incomplete for billing | Mahogany | "Incomplete for billing: 2 fields missing" | Billing |
| Renewal within 30 days | Mahogany | "Renewal on 23 Oct 2026 (in 21 days)" | Details, Customer role card |
| Go-live overdue | Carmine | "EU VoP / DE: Go-live overdue by 4 days" | Products & onboarding |
| KYB expiring (within 90 days) | Mahogany | "Licence expires on 25 Oct 2026 (in 23 days)" | Compliance |
| Sanctions | Carmine | "Sanctions screening: Potential match under review" | Compliance |
| Periodic review overdue | Carmine | "Periodic review overdue since 27 Sep 2026" | Compliance |
| Coverage issue | Mahogany (Degraded), carmine (Suspended) | "Partner coverage issue: GB / UK CoP Degraded since 02 Oct 2026" | Partner |
| No active champion | Mahogany | "No active champion since 18 Sep 2026" | Contacts |
Team-specific worklist rules (go-lives in next 14 days, too long in stage, required fields empty, renewals beyond 30 days) stay on Home only. "No contract attached" shows on the Roles card and Details, never as an alert.

**Products and stages** (one row per contracted product line, excluding cancelled): Product (scheme tag), Country, Current stage, In stage since, Target go-live, Flags ("Blocked" badge, "Billable from <date>"). If the contracting entity differs: sub-line "Contracting entity: <entity>". On the contracting entity's own Overview the product is listed read-only with sub-line "Contracted for <customer entity>" (resolution 45). Partner entities: same card adds "Coverage: Active 1, Degraded 1, Onboarding 1".

**Roles** ("View in Details"): Customer sub-card: contract reference ("IPE-MSA-2026-014, Group master agreement"), renewal date ("15 Jan 2027"); empty "No contract attached" (amber), "No renewal date recorded". Network partner sub-card: connection method ("Via routing provider (ClearRoute Services)"), partner agreement reference, coverage counts.

**Key people:** one row per role in order Champion, Decision maker, Technical, Incident, Escalation, Billing: role, name, email, phone, "Verified 47 days ago". Dual-role entities: two groups "Customer" and "Partner". Empty role: "No active <role> contact"; empty incident: carmine "No active incident contact".

**Current owner:** "Owner: Emma Wilson, Customer Success, since 14 Sep 2026".

**Latest interactions:** 5 most recent History entries (notes and events). Row: type chip · author · team · date · first line of summary, e.g. "QBR · Emma Wilson · Customer Success · 01 Oct 2026 · Q3 review, volumes on track in DE". Same list feeds M10 "Latest interactions".

**Other entities in this group:** legal name (link to its Overview), country, LEI, roles. Excludes soft-deleted.

**States:** Loading: skeleton card per section. Error: per section "This section could not be loaded. Retry." (others render). Empty lines: "No products recorded", "No History entries yet", "No active alerts", "No contacts recorded". Read-only always. Soft-deleted: per conventions.

**ACs:** M1 AC14, AC15, empty states; M3 edge case 4; M4 empty state; M5 AC12; M6 AC11, AC13; M7 AC7, AC8; M10 AC4; M12 AC15; resolutions 40 to 43, 45; scenario decision 8.

---

### 6.3 Details tab (S4.9), key `details`

**Release:** R1 with every card rendered and three edits: Edit roles (add only), Attach contract (new entity contract) and Edit renewal date (CS); R2 adds entity core edit, role removal, master agreement option, Attach partner agreement, Mark as Inactive and the commercial terms, SLA and special terms edits.

**Purpose:** the only place entity data is edited (decision P2). Each card edited only by its owning team; everyone else reads with "Owned by <Team>". All 6 teams can open it.

**Entry points:** tab bar; Overview Roles "View in Details"; Billing banner "Contract reference" link (M14 AC8); Compliance LEI card "Edit on Details tab" (Ops); group row menu "Open Details tab"; Ops worklist "Required fields empty" (M11 AC9); CS worklist "Renewals in the next 120 days" (lands on renewal date, M11 AC11).

**Layout:** header "Details" + line "Each card is edited by its owning team". Single column of cards, max width 960px, order: Entity core, Roles, Customer role (only with Customer role), Partner role (only with Network partner role), Lifecycle state. Card header: title, owner label (non-owners) or "Edit" (owners). Customer role card carries a label per field group. "Edit" switches the card inline to a form with "Save" / "Cancel", except the dialogs below. At 1024px field lists become one column.

**Entity core card** (Owned by Ops, M2 AC16)
| Field | Rule |
|---|---|
| Legal name | Required, max 200 |
| Aliases | Chips, each max 100 chars (M2 AC2) |
| Type | Bank, Fintech, PSP |
| Country | ISO alpha-2. If different from GLEIF: "GLEIF records <XX> for this LEI"; override logged (M2 AC6, AC17) |
| LEI | ISO 17442 check. Shows badge + "From GLEIF, checked 02 Oct 2026 09:14". A change runs the live GLEIF lookup (cached copy for demo LEIs) and the duplicate check, with the same panels as wizard step 1 (resolution 54) |
| BICs | 8 or 11 chars, M2 AC4 rules |
| Group | Picker of groups + "Standalone entity"; "Create group" opens the S5 group dialog (M4 AC5, AC6) |

**Roles card** (Owned by Ops, M4 AC7, AC8): chips "Customer", "Network partner"; Ops sees "Edit roles". Dialog: checkboxes "Customer", "Network partner", at least one required. Removing a role with data shows: "Remove the Network partner role from <entity>? This hides <n> coverage rows and the Partner agreement card. The data is kept and returns if you add the role again." Buttons "Remove role", "Cancel". Adding Network partner shows the Partner tab; removing Customer hides Products & onboarding. History "Role added: Network partner" / "Role removed: Customer".

**Customer role card** (mixed ownership)
| Field group | Owner | Content | Action |
|---|---|---|---|
| Contract reference | Ops (M4 AC9, AC10) | Contract ID, title, signing date, scope ("Group master agreement · Applies to 3 entities"), invoiced entity, document link. Empty: "No contract attached" (amber) | "Attach contract" / "Edit contract" |
| Renewal date | Customer Success | "15 Jan 2027 (in 105 days)". Empty "No renewal date recorded" | "Edit renewal date" |
| Handoff summary | Sales (M3 AC6, AC7) | Promised SLAs (availability %, max response time, other SLA commitments), special terms, contracted entities not yet in the portal, notes for Onboarding. The Sales → Ops handoff keeps its own snapshot (resolution 32) | "Edit handoff summary" |
| Commercial terms | Sales and Finance (label "Owned by Sales and Finance") | Currency, price per verification, volume tiers, monthly minimum, payment term; wizard step 2 rules. Last save wins; both audited (M15 edge case 2) | "Edit commercial terms" |

**Attach contract dialog** (Ops): radio "Use an existing group master agreement" (picker shows "Applies to 3 entities: <names>") or "New contract": Contract ID (3 to 50 chars, letters, digits, `-`, `/`, `_`), Title, Signing date (not in future), Scope (Entity contract, Group master agreement), Invoiced entity (group entities, default this entity), Document link (https://). Buttons "Attach contract", "Cancel". On save: History "Contract <ID> attached" on every entity using it; billing flag recomputed.

**Edit renewal date dialog** (CS): date picker (valid, not in the past), optional note. Buttons "Save renewal date", "Cancel". Recomputes CS renewals worklist and Overview alert.

**Partner role card** (Owned by Ops, M4 AC11, resolution 51): partner agreement reference: contract ID, title, signing date, scope, document link. Empty "No partner agreement reference". "Attach partner agreement" opens the attach dialog without the group master option. Link "View coverage on the Partner tab".

**Lifecycle state card** (Owned by Ops): chip Onboarding / Live / BAU / Inactive; first three show "Computed from the product stages" ("Computed from partner coverage" on partner-only entities, decision B1). Ops: "Mark as inactive" (or "Mark as active" when Inactive). Inactive dialog: reason required 10 to 500 chars; buttons "Mark as inactive", "Cancel". Mark as active recomputes from stages (M6 AC12). History "Lifecycle state: Live → Inactive. Reason: <reason>. By <user>, <team>".

**Actions**
| Action | Who | AC |
|---|---|---|
| Edit entity core | Ops | M2 AC16, AC17; M4 AC5, AC6 |
| Add/remove role | Ops | M4 AC7, AC8, AC14 |
| Attach/edit/remove contract ref, change invoiced entity | Ops | M4 AC9, AC10, AC14; M14 AC1 |
| Edit renewal date | CS | M11 AC11 |
| Edit handoff summary | Sales | M3 AC14 |
| Edit commercial terms | Sales, Finance. History "Commercial terms changed" | M3 AC14, AC17; D3 |
| Attach/edit partner agreement ref | Ops | M4 AC11, AC13 |
| Mark as inactive / active | Ops | M15 AC3; M6 AC12 |
| Read all cards | All 6 teams | M15 AC7, AC8 |

**States:** Loading: skeleton per card, Edit disabled until loaded. Load error per card: "This section could not be loaded. Retry." Save error: card stays in edit mode, values kept, "Changes not saved. Try again." Concurrent edit: "This section was updated by <name> at <time>. Reload to see the latest values." Read-only: text + lock + owner label, no Edit. Partner-only: no Customer role card. Inactive: chip on card and header, cards stay editable. 403: "You can't edit this. Owned by Ops. Your team: Sales." Soft-deleted: admin read-only, all Edit hidden.

**ACs:** M1 AC20; M2 AC6, AC16, AC17; M3 AC5 to AC7, AC14, AC15, AC17; M4 AC5 to AC11, AC13 to AC15; M6 AC12; M11 AC9, AC11; M12 AC3; M14 AC1, AC8; M15 AC3, AC7, AC8, AC10.

---

### 6.4 Products & onboarding tab (S4.2), key `products`

**Release:** R1 with bands, Change stage (N+1 only), Mark as blocked and Resolve block; R2 adds skip and back moves, Edit block, Edit target go-live, Add and Edit product line and Mark as cancelled.

**Purpose:** per product line, show and update the onboarding stage, blocks, target go-live and billing start. Hidden for entities without the Customer role.

**Entry points:** tab bar; Overview link and alerts; worklist items "Blocked", "Too long in current stage", "Go-lives in the next 14 days", "Overdue go-lives" (deep link to the band anchor, M6 AC14).

**Layout:** header "Products & onboarding", "Owned by Ops" for non-Ops, "Add product line" (Ops). One band per product line, ordered by target go-live ascending; bands live on the customer record even when the contracting entity is another group entity. Cancelled lines at the bottom in collapsed "Cancelled product lines (n)". At 1024px stage track uses short labels "Contract", "Kickoff", "Sandbox", "Testing", "UAT", "Approval", "Hypercare", "Ramp-up", "BAU" with full name in tooltip.

**Band** (full-width card, anchor id per product line)
- Header: scheme tag, country, "Contracting entity: <entity>" when different.
- Stage track, 9 fixed segments: Contract signed, Kickoff, Sandbox & technical integration, Testing & certification, UAT, Go-live approval, Live & hypercare, Ramp-up, BAU. Styles: completed (azure `#DAEBEB` + check), current (forest teal fill, white text), future (grey outline), skipped (hatched grey, label "Skipped", M6 AC5), current and blocked (carmine outline + blocked icon).
- Facts: "Current stage: UAT", "Entered 22 Sep 2026", "10 days in stage", "Target go-live 30 Oct 2026".
- Indicators: "Go-live overdue by <n> days" (carmine chip, M6 AC10); "Billable from <date>" (green chip, M6 AC11).
- Block badge (carmine): "Blocked by <Customer|Corvane|Partner> since <date>: <reason>" (M6 AC7).
- Actions. Ops: "Change stage", "Mark as blocked" (or "Edit block" + "Resolve block" when blocked), menu "Mark as cancelled". Ops and Sales: "Edit target go-live", "Edit product line".
- Cancelled band: greyed track, chip "Cancelled on <date>" + reason, no actions. Lines are never deleted.

**Change stage dialog** (Ops)
| Element | Rule |
|---|---|
| Title | "Change stage: <scheme> / <country>" |
| Current stage | Read-only "UAT, entered 22 Sep 2026" |
| New stage | Required select of all 9, current disabled |
| Entry date | Required, default today, ≤ today, ≥ current stage entry date |
| Note | Optional, max 500, for forward move to N+1 |
| Reason | Required 5 to 500 when skip (> N+1) or backward. Skip helper "Stages <X> and <Y> will be marked as Skipped". Placeholder "Certification waived: existing EPC VoP participant" |
| Backward helper | "Moving back from <stage> to <stage>" (M6 AC6) |
| Billing helper | Moving from Live & hypercare or later to before it: "The Billable from date will be removed." |
| Open block panel | If blocked: block text + "Resolve block" checkbox, unchecked by default (M6 AC9) |
| Buttons | "Cancel", "Save stage" |
| Errors | "Entry date cannot be in the future"; "Entry date cannot be earlier than <date> (current stage date)"; "Reason is required (5 to 500 characters)"; "Stage not saved. Try again."; concurrent "This stage was updated by another user. Reload to see the latest stage." (M6 edge case 5) |
| On save | Band updates, days in stage resets to 0, header lifecycle chip recomputes (M6 AC12), toast "Stage changed to <stage>". Skip marks skipped stages; backward returns later stages to future style and logs "Stage moved back" |

**Mark as blocked** (Ops): title "Mark as blocked: <scheme> / <country>"; Blocked by (required radio: Customer, Corvane, Partner); Reason (required 5 to 500); Blocked since read-only today. Buttons "Cancel", "Mark as blocked".
**Edit block** (Ops): same fields prefilled, Blocked since read-only. Buttons "Cancel", "Save block".
**Resolve block** (Ops): title "Resolve block: <scheme> / <country>"; summary "Blocked by Partner since 24 Sep 2026 (8 days)"; Resolution note optional max 500. Buttons "Cancel", "Resolve block". History records duration in days.
**Edit target go-live** (Ops, Sales): new date required, not in the past, not earlier than contract signing date if a contract exists; Reason required 5 to 500. Errors "Target go-live is in the past", "Target go-live cannot be earlier than the contract signing date". Buttons "Cancel", "Save target date".
**Add product line** (Ops) / **Edit product line** (Ops, Sales): product/scheme, country, contracting entity (this entity or another entity of the same group), target go-live, reason (required on edit). Rules: UK CoP only GB; EU VoP only SEPA countries; product + country + contracting entity unique. Errors reuse M3 inline messages. New line starts at Contract signed, entry date today (M6 AC2). History "Product line added: <product>, <country>, target go-live <date>".
**Mark as cancelled** (Ops): title "Cancel product line: <scheme> / <country>"; reason required 5 to 500; buttons "Mark as cancelled", "Keep product line". Stage history kept. History "Product line cancelled: <scheme> / <country>. Reason: <reason>".

**States**
| State | Copy |
|---|---|
| Empty | "No products contracted yet. Products are added in the customer handoff (Sales) or with Add product line (Ops)." (Ops also sees "Add product line") |
| Loading | Skeleton band per product; controls disabled |
| Error (load) | "Onboarding data could not be loaded" + Retry |
| Error (save) | Dialog stays open, values kept, band unchanged: "Stage not saved. Try again." |
| Read-only (CS, Network, Compliance, Finance) | All data visible, no stage/block controls, "Owned by Ops" + lock |
| Read-only (Sales) | As above plus "Edit target go-live" and "Edit product line"; "Owned by Ops" on stage controls |
| Soft-deleted | Admin read-only, all controls hidden |

**ACs:** M6 AC1 to AC17, states, edge cases 1 to 6; M3 AC1 to AC3, AC14, AC17, edge cases 1, 2, 4; M11 AC6 to AC8; resolutions 44 to 46.

---

### 6.5 Contacts tab (S4.3), key `contacts`

**Release:** R1 with role groups, context sections, header-filtered view, Former contacts (collapsed), the Add contact and Edit contact drawer including time zone and availability (B12) and Mark as verified; R2 adds Mark as left, Set as primary, the duplicate warning and "Copy details from".

**Purpose:** every customer and partner contact with explicit role, owning team and verification date. Partner contacts are created here in the Partner context (the Partner tab has no contacts block).

**Ownership** (owning team is set automatically from context + role, M15 AC4):
| Context | Role | Owning team | Label |
|---|---|---|---|
| Customer | Champion, Decision maker | Sales and CS | "Owned by Sales and Customer Success" (always, before and after handoffs) |
| Customer | Technical, Incident, Escalation | Ops | "Owned by Ops" |
| Partner | Incident, Escalation, Technical, Champion, Decision maker | Network | "Owned by Network" |
| Either | Billing | Finance | "Owned by Finance" |
A user moved to another team does not move contacts (M15 edge case 3). Removing the Partner role keeps Network ownership (M15 edge case 4).

**Entry points:** tab bar; header "All incident and escalation contacts" (pre-filtered); Overview; worklist items "Partner contacts not verified for 90+ days", "Billing contacts not verified for 6+ months", "Champion left".

**Layout:** toolbar with role filter chips (All, Incident, Escalation, Technical, Champion, Decision maker, Billing), context switch "Customer" / "Partner" when entity has both roles (default: both shown as sections), "Add contact" for users whose team owns at least one role here. Body grouped by context (Partner first on partner entities), then role in order Incident, Escalation, Technical, Champion, Decision maker, Billing (M7 AC11). Group header: "<Context> · <Role> · <count> · Owned by <Team>". Bottom: collapsed "Former contacts (n)" (M7 AC6). At 1024px rows wrap to two lines.

**Contact row** (within a role: Primary first, then most recent Last verified)
| Field | Content |
|---|---|
| Name, job title | "Marta Kovacs, Payments Operations Lead" |
| Chips | "Primary" (Incident only), "Active" or "Left" |
| Email | `mailto:` |
| Phone | `tel:` + copy icon |
| Time zone, local time | "Europe/London", "Local time 13:12" |
| Availability | "Mon to Fri, 08:00 to 18:00" or "24/7" + "Available now" / "Outside availability" |
| Verification | "Verified 47 days ago by Lukas Brenner"; mahogany when > 90 days (partner contacts) or > 6 months (billing) |
| Row actions (owning team) | "Mark as verified", "Edit", "Set as primary" (Incident only), "Mark as left" |
CS viewers see in the Billing group "Billing contacts are owned by Finance" (M7 edge case 5). Example: a Singapore incident contact "Mon to Fri, 09:00 to 18:00, Asia/Singapore" seen at 15:00 Bucharest shows "Local time 20:00, Outside availability", Escalation group directly below.

**Add contact / Edit contact drawer** (right side, 480px)
| Field | Rule |
|---|---|
| Role context | Only when entity has both roles: Customer or Partner (M7 AC1) |
| Role | Required; only roles the user's team owns in that context |
| Full name | Required, 2 to 120 |
| Email | Required, valid: "Enter a valid email address". If it matches another contact on this entity: link "Copy details from <name> (<role>)" (M7 AC2) |
| Phone | Required for Incident, Escalation. International format, error "Use international format, for example +447700900123"; `0044 7700 900123` gets hint "+447700900123" |
| Time zone | Searchable IANA list; required for Incident, Escalation, Technical |
| Availability | "24/7" or weekdays + start/end HH:MM; required for Incident, Escalation; windows crossing midnight accepted |
| Job title | Optional, max 120 |
| Status | Edit only: Active or Left (restores a contact marked left by mistake) |
| Buttons | "Cancel", "Save contact" |
| Duplicate | "<name> is already an active <role> contact" with "Cancel", "Save anyway" (M7 AC12) |
| Save error | Drawer stays open: "Contact not saved. Try again." |
On create: Last verified = today by creator; History "contact added". On edit: Last verified unchanged; History event for phone, email, availability changes.

**Mark as left dialog:** title "Mark <name> as left"; Leave date required ≤ today; Note optional; last incident warning "<entity> will have no active incident contact"; last champion info "<entity> will have no active champion. Sales will see this on the worklist."; buttons "Cancel", "Mark as left". Contact moves to Former contacts, row shows "Left on <date>".

**Mark as verified:** inline, no dialog; row shows "Verified today by <user>", toast "Marked as verified"; audit only.

**Set as primary** (Incident only): flag moves from previous primary; History "Incident contact changed: Primary is now <new> (was <old>). By <user>, <team>."

**Actions:** add/edit/verify/set primary/mark left/restore via Edit: owning team only (see ownership table). Call, email, copy phone: all teams. Delete contact: nobody, no control.

**States:** Empty tab "No contacts yet." (owners see "Add contact"). Empty role group "No contacts for this role yet. Add a contact." ("Add a contact" link only for the owning team). Loading: skeleton role groups (header incident block first on partners). Load error "Contacts could not be loaded" + Retry. Read-only: no row actions, lock + owner label per group. No active incident contact: carmine in header (partner) or Overview (customer) and on the empty Incident group. Soft-deleted: admin read-only.

**ACs:** M7 AC1 to AC15, states, edge cases 1 to 6; M8 AC11; M15 AC4, AC7, AC8; resolutions 42, 47, 48, 52.

---

### 6.6 History tab (S4.4), key `history`

**Release:** R1 with the timeline (M10 AC8 default set applied on the server), note and event cards, Add note drawer and Load more; R2 adds the filter bar, "Open action items only", Edit note (24 h) and the action item toggle.

**Purpose:** shared filterable timeline of notes and automatic events.

**Layout:** toolbar: "Add note" (primary), filters "Team" (multi), "Event type" (multi), toggle "Open action items only", "Reset filters", count ("48 items"). Timeline newest first, 50 per page, "Load more". Add/Edit note in a right drawer 560px (full-height overlay at 1024px).

**Note card:** type chip (Call, QBR, Negotiation, Incident, Payment, Other); "<author> · <team>"; "Interaction on <date>"; "Added <date>, <HH:MM>"; "Edited <date>, <HH:MM>" when edited; participants with labels "Former contact" and "Inactive user"; summary (plain text, line breaks, collapsed after 6 lines with "Show more"); action items (checkbox, description, owner, due date, status Open/Done, "Overdue" when due date passed and Open; checkbox enabled only for note author and item owner; Done shows "Done by <user> on <date>"); "Edit" for the author within 24 hours of creation. No delete control.

**Event card** (read-only, system icon): text, actor, actor team, timestamp, old → new. Copy patterns:
- Stage: "EU VoP / DE: UAT → Go-live approval (entered 01 Oct 2026). By Adrian Koh, Ops"
- Block: "UK CoP / GB marked blocked by Partner: <reason>"; "UK CoP / GB block resolved after <n> days"
- Contact: "Incident contact changed: Primary is now Paul Grant (was Marta Kovacs). By Lukas Brenner, Network."
- Handoff (each with link "View handoff summary"): "Handoff sent to <user> by <user>"; "Handoff confirmed by <user>"; "Handoff accepted by <user>. Owner: <old> → <new>"
- Owner: "Owner reassigned: <old> → <new>. Reason: <reason>. By <user>, <team>" (M9 AC8)
- Network and structure: "Coverage GB / UK CoP: Active → Degraded (effective 02 Oct 2026). Reason: <reason>. By <user>, <team>."; "Role added: Network partner"; "Linked to group Santander by Adrian Koh"; "Record created by Tom Hadley (Sales)"
- Other field changes: "Duplicate warning acknowledged: <reason>"; "Commercial terms changed". Compliance and admin see link "View audit details" (opens Audit tab filtered to that change); every other team sees old and new value inline, e.g. "Payment term: 30 → 45 days".

**Filters:** Team: Sales, Ops / Onboarding, Customer Success, Network, Compliance, Finance (all on). Event type: Call, QBR, Negotiation, Incident, Payment, Other, Stage change, Contact change, Handoff, Owner reassigned, Network and structure, Other field changes (all on except "Other field changes"). OR within a filter, AND across. "Reset filters" restores defaults. Selections persist for the browser session.

**Add note / Edit note drawer** (title "Add note" / "Edit note")
| Field | Rule | Error |
|---|---|---|
| Type | Required single select | "Choose a type" |
| Interaction date | Required, default today, not future | "Interaction date cannot be in the future" |
| Participants | Optional multi-select from "Colleagues" (active users), "Contacts at <entity>" (active contacts), "Other people" (free text, max 10) | |
| Summary | Required 20 to 5,000, counter | "Summary must be 20 to 5,000 characters" |
| Action items | 0 to 20 rows: description (required, max 300), owner (required, active user), due date (required, ≥ today). "Add action item", row remove icon | "Complete the description, owner and due date, or remove this row" |
Buttons "Cancel", "Save note". On save: card at top, toast "Note added", Overview Latest interactions updates.

**Actions:** Add note: all 6 teams (not on soft-deleted). Edit note: author only within 24 h (old/new in audit). Toggle action item: note author and item owner, any time, who/when recorded. Filter, Load more, open handoff summary: all. Open audit details: Compliance, admin. Edit/delete events, delete notes: nobody.

**States:** Empty "No history yet. Add the first note to start the shared history." + "Add note". Filtered empty "No items match these filters" + "Reset filters". Loading: three skeleton cards; "Load more" spinner. Load error "Could not load history" + "Retry". Save error "Note not saved. Try again." (input kept). Edit window closed: "The edit window for this note has closed" (drawer stays, note unchanged). Read-only: no Edit on notes > 24 h, other authors' notes, events. Soft-deleted: read-only, "Add note" hidden.

**ACs:** M10 AC1 to AC12, states, edge cases 1 to 5; M9 AC8, AC12; M2 AC18; M3 AC17; M4 AC14; M5 AC15; M6 AC17; M7 AC15; M8 AC17; M12 AC14; resolutions 40, 49, 50.

---

### 6.7 Partner tab (S4.5), key `partner`

**Release:** R1 with the coverage table by scheme, status history, counts line, Change status (effective date no later than today), read-only connection method card and retired collapse; R2 adds Add coverage, Edit connection method, Scheduled status and the Partner agreement summary card.

**Visibility:** only with the Network partner role, all 6 teams. Network edits; others read ("Owned by Network").

**Layout:** header "Partner", owner label, counts line "Active 1, Degraded 1, Onboarding 1". Left (1/3): "Connection method" card, then "Partner agreement" card. Right (2/3): coverage grouped by scheme (EU VoP, UK CoP, Global validation), each a table sorted by country; "Add coverage" (Network) top right; collapsed "Retired coverage (n)" at bottom. At 1024px left column moves above.

**Connection method card:** "Connection method" ∈ `Direct`, `Via scheme`, `Via routing provider`; "Provider name" only for routing provider (e.g. "Via routing provider · ClearRoute Services"). Network: "Edit". Empty: "No connection method recorded" + "Set connection method" (Network).
**Edit connection method dialog:** method radio; Provider name 2 to 120 chars, required for `Via routing provider`. Switching away clears provider, helper "The provider name is cleared. The audit log keeps the old value." History "Connection method: Direct → Via routing provider (ClearRoute Services)".

**Partner agreement card** ("Owned by Compliance"): read-only "Incident notification: <n> hours · Expires <date>" (Lloyds Bank plc with the seed: "Incident notification: 1 hour · Expires <today+545>", decision B2; singular "hour" when n = 1) + "View obligations on the Compliance tab" (opens Compliance on the Partner agreement card). Also the partner agreement reference contract ID read-only with "View on the Details tab".

**Coverage table** (per scheme group: scheme tag + row count). Columns: Country ("GB United Kingdom"), Status badge, Since ("since 02 Oct 2026"), Days in status, Reason, Actions (Network: "Change status"), expand chevron "Status history".
Status badges: Onboarding (neutral grey), Active `#008148`, Degraded `#BA450B`, Suspended `#96031A`, Retired (muted grey, text 38%). Future effective date adds chip "Scheduled" (neutral outline) + "from <date>".
Status history (expanded, read-only, newest first): "<status> · effective <date> · <reason> · <user> · <timestamp>".

**Add coverage dialog** (Network): Country (searchable ISO), Scheme (EU VoP, UK CoP, Global validation), Status (default Onboarding), Effective date (default today, ≤ today + 30 days; future = "Scheduled"; error "Effective date can be at most 30 days ahead"), Reason (default "Initial coverage"). Rules: "UK CoP coverage must use country GB"; "EU VoP coverage must use a SEPA country"; duplicate pair "Coverage for <CC> / <scheme> already exists" + link "Go to existing row".

**Change status dialog** (Network): title "Change status: <CC> / <scheme>"; current status read-only; New status (the four other values; for a Retired row only Onboarding with hint "Re-onboarding a retired coverage"); Effective date (default today, max today, min current status date; error "Effective date cannot be earlier than <date> (current status date)"); Reason 5 to 500 with counter. Buttons "Save status", "Cancel". History (Network and structure): "Coverage GB / UK CoP: Active → Degraded (effective 02 Oct 2026). Reason: Response times above 2s on CoP requests. By Lukas Brenner, Network." Retiring a row created in error: status Retired, reason "Created in error", row moves to Retired coverage. Delete coverage: nobody.

**States:** Empty "No coverage recorded yet." (+ "Add coverage" for Network). Loading skeleton, controls disabled. Load error "Coverage could not be loaded" + "Retry". Save error "Change not saved. Try again." (dialog keeps values, no partial row). Conflict "This coverage was updated by <name> at <HH:MM>. Reload to see the latest status." + "Reload". Read-only: no Add/Edit/Change status, history still expandable, "Owned by Network". Soft-deleted: admin read-only.

**ACs:** M5 AC1 to AC17; M4 AC7, AC8, AC11; M15 AC3, AC7, AC8; resolutions 51 to 53, 58.

---

### 6.8 Compliance tab (S4.6), key `compliance`

**Release:** R1 with all four KYB cards (Licence Record verification and LEI Refresh from GLEIF editable; Ownership and Sanctions read-only), the periodic review card read-only with Overdue computed, and the Customer agreement card with Edit; R2 adds Ownership and Sanctions edit, Schedule and complete review, the Partner agreement card and the obligation expiry badge.

**Visibility:** all 6 teams; Compliance edits; admin read-only; others "Owned by Compliance".

**Layout:** header "Compliance". Section "KYB checks": 2 × 2 cards Licence, LEI, Ownership structure, Sanctions screening (one per row at 1024px). Section "Periodic review": one full-width card. Section "Contractual obligations": "Customer agreement" and "Partner agreement" cards side by side (stacked at 1024px), each shown only while the entity holds that role. Link "See all agreements in Obligations view" (Search S2).

**KYB card (all):** title, status chip (Not started grey, Verified `#008148`, Expiring `#BA450B`, Expired `#96031A`), check fields, "Verified by <user> on <date>", expiry ("Expires on 31 Mar 2028 (in 546 days)"), evidence link with external icon (new tab), Compliance button "Record verification" / "Update verification".
| Card | Fields |
|---|---|
| Licence | Licence number, Issuing authority, Expiry date or "No expiry date" |
| LEI | LEI from the entity (Ops sees "Edit on Details tab"), GLEIF status and next renewal from live GLEIF, tag "From GLEIF · fetched <timestamp>", "Refresh from GLEIF" (Compliance; spinner and disabled while running). Card expiry = GLEIF next renewal date. Refresh audit source "System (GLEIF)" with requesting user |
| Ownership structure | Summary ("Parent: UniCredit S.p.A., 99.9%. UBO: none above 25%."), Parent entity name. Note "No expiry. Re-verified at the periodic review." |
| Sanctions screening | Result: "No match" / "Potential match under review" / "Confirmed match"; Lists or provider screened ("EU, UK HMT, OFAC SDN"). Same no-expiry note |
**Record verification dialog:** check fields; Verified by read-only = current user; Verified on (default today, not future, not after expiry); Evidence link required, https:// on an approved host (error "Use a link to approved document storage"). On save toast "Verification saved", audit per field, History "Other field changes" event. An existing link outside approved storage shows warning "Link outside approved storage".

**Periodic review card:** status chip Planned / In progress / Completed / Overdue (Overdue is computed, not selectable); marker "Past due" when moved from Overdue to In progress; Last review date, Next review date, "Completed <date>" for last cycle. Compliance: "Schedule review", "Edit review", "Complete review". Complete dialog: Completion date (not future), New next review date (> completion). After Completed, status becomes Planned with the new date.

**Obligations card:** title, counter "<n> of 8 captured", "Last updated by <user> (<team>), <timestamp>", expiry badge "Expired" or "Expires in N days". Fields: Incident notification time (hours), Subprocessor change notice (days; 0 shows "No advance notice required"), Audit right (Yes/No), Availability SLA (%), EU VoP status, UK CoP status, Agreement expiry date, Contract PDF link. Empty field "Not captured". Compliance: "Edit" or "Add obligations"; validation per M13 AC2, AC4 (e.g. "Enter a whole number of hours between 1 and 720"). One audit entry per changed field.

**States:** KYB empty "Not verified yet". Review empty "No review scheduled" (+ "Schedule review"). Obligations empty "No obligations captured yet" (+ "Add obligations"; others "Owned by Compliance"). No LEI: "No LEI on this entity" + link to Details, refresh disabled, Not started. Loading skeleton cards. KYB save error "Not saved. Try again." GLEIF unavailable "GLEIF unavailable, showing data from <timestamp>" (demo LEIs filled from cache). LEI not found "LEI not found in GLEIF", chip Expired. Obligations load "Couldn't load obligations. Retry"; save banner "Changes not saved. Try again" (values kept). Read-only: everything visible, no edit/record/refresh. Removed role hides its obligations card; data returns when role is restored.

**ACs:** M12 AC1 to AC16; M13 AC1 to AC8, AC14; M15 AC3, AC7, AC9, AC10; resolutions 25, 54.

---

### 6.9 Billing tab (S4.7), key `billing`

**Release:** R1 read-only for every team (banner, profile card, contract reference card, "Billed through", billing contacts card, partner-only note); R2 adds Create and Edit billing profile for Finance.

**Visibility:** all 6 teams; Finance edits; others "Owned by Finance".

**Layout:** banner area (only when flagged); card "Billing profile" (two columns at 1280px, one at 1024px); card "Contract reference" (read-only, "Owned by Ops"); card "Billing contacts" (read-only).

**Incomplete for billing banner** (amber `#BA450B` icon and border, light fill): "Incomplete for billing. Missing: <fields>. Invalid format: <fields>". Each field name is a link that scrolls to and focuses the field. Under "Contract reference": hint "Ops attaches the contract on the Customer role" linking to Details, Customer role card. Missing/invalid fields get an amber left border and helper "Missing" or the format message (e.g. "LEI must be 20 characters and pass the check digit test").

**Billing profile fields:** Billing legal name (prefilled from entity legal name), Street, City, Postal code, Country (ISO picker), VAT / tax ID, LEI (prefilled from entity LEI), Contracting Corvane entity (select "Corvane Singapore Pte. Ltd.", "Corvane Europe B.V."). With Contract reference these are the 9 flag fields. Finance: "Edit" / "Create billing profile", then "Save" / "Cancel". Partial save allowed; banner and header badge update without reload. LEI differs: non-blocking "Differs from entity LEI <LEI>". Stored Corvane entity no longer offered: "No longer in list", counted invalid. Format errors field-level, e.g. "VAT ID must start with DE for Germany".

**Contract reference card:** Contract ID, Title, Scope, Invoiced entity, Document link, "View on the Details tab". Empty: amber "No contract attached" + the Ops hint.

**Billed through another entity:** if the applicable contract names another invoiced entity, profile card shows "Billed through <entity>" linking to that entity's Billing tab; no banner, no badge, no Finance worklist row.

**Billing contacts card:** active Billing contacts: name, email, phone, "Verified <n> days ago by <user>", link "Manage in Contacts" (opens Billing group). Not part of the flag.

**Partner-only entity:** "Billing profile not required: partner role only"; Finance may still edit; no banner, no badge.

**States:** Empty "No billing profile yet" (customer-role: badge shown, banner lists all 9 fields, Finance sees "Create billing profile"). Loading: skeleton; badge never shown provisionally. Load error "Couldn't load billing profile. Retry". Save error "Changes not saved" (values kept). Complete: no banner/badge, line "Billing profile complete". Read-only: values as text, missing/invalid list still visible. Inactive or soft-deleted: no flag computed; soft-deleted read-only for admin only.

**ACs:** M14 AC1 to AC14; M4 AC9; D1; M15 AC3, AC7, AC8; resolution 55.

---

### 6.10 Audit tab (S4.8), key `audit`

**Release:** R1 with the list newest first, 50 per page with Load more, and the deleted-record admin view; R2 adds the Field, User and Date range filters, the count line and "Expand" for long values.

**Visibility:** Compliance and the admin only. Others: no tab, 403 on `GET /api/entities/{id}/audit`, direct URL shows "The audit log is visible to Compliance and the admin." User team changes are not here (see 6.12.1).

**Layout:** filter bar: Field (multi-select of fields in this entity's log, each option labelled "<Object> · <Field>", e.g. "KYB: Licence · Expiry date"), User (multi), Date range (from, to, inclusive local dates), "Clear filters", count "<n> changes". AND across filters. Table full width, newest first, 50 per page, "Load more".

**Columns:** Timestamp ("02 Oct 2026 10:05 (UTC+03:00)"), Object ("Coverage row: GB / UK CoP", "Contact: Paul Grant (Incident)", "KYB: Licence", "Billing profile", "Record status"), Field, Old value, New value, User, Team (team at time of change, never rewritten). Create: old "(none)". Removal: new "(removed)". Values > 200 chars truncated with "Expand". System actions: user "System (GLEIF), requested by <user>". Record status rows show the deletion reason as a second line. Impersonated changes show the impersonated user and team. No edit or delete control and no endpoint.

**States:** Empty "No changes recorded yet". Filtered empty "No changes match these filters" + "Clear filters". Loading skeleton rows. Error "Couldn't load the audit log. Retry". Always read-only. Soft-deleted: admin read-only.

**ACs:** M16 AC1 to AC7, edge cases 1, 2, 5; M1 AC16; M4 AC13; M5 AC14; M12 AC14; M13 AC5; M14 AC14.

---

### 6.11 Group record (S5)

**Release:** R1 with header, five exposure tiles, contracts panel, member table, Link entity (standalone entities only) and Unlink; R2 adds Move to another group, Create and Edit group, the admin line "<n> deleted entity" and opening the group by contract ID search.

**Route:** `/groups/{id}`. Search by a group master agreement contract ID opens it (M1 AC18).

**Purpose:** all legal entities of a group with roles, contract, invoiced entity and product stages; Ops maintains structure. All 6 teams view; non-Ops see "Owned by Ops".

**Layout:** group header (name as page title; Parent name; Parent LEI with "From GLEIF" or "Not verified with GLEIF"; Headquarters country; Ops actions "Edit group", "Link entity"); exposure strip of five tiles; contracts panel; member entities table with contract filter; admin-only line "<n> deleted entity (visible to admin)". At 1024px tiles wrap 3 + 2, contracts panel under the table, table scrolls with legal name pinned. The parent has no entity record (M4 edge case 2).

**Exposure tiles (M4 AC2), exclude soft-deleted:** "Entities <n>"; "Customer <n> · Network partner <n> · Both <n>"; "Product lines by stage" (mini list, e.g. "Contract signed 1 · UAT 1"); "Countries GB, PT, IT"; "No contract attached <n>" (amber when > 0).

**Contracts panel:** one line per contract: "<ID> · <title> · <scope> · Applies to <n> entities: <names> · Invoiced: <entity>" + document link.

**Member table columns:** Legal name (link), Country, LEI, LEI status badge, BICs, Roles (chips), Applicable contract (ID + title; amber "No contract attached" when empty), Invoiced entity, Products and stages (one line per product, e.g. "EU VoP PT · Ramp-up"), Actions (Ops menu: "Open Details tab", "Move to another group", "Unlink"). Roles, contract and invoiced entity are edited on the entity's Details tab.

**Dialogs (Ops)**
| Dialog | Fields and rules | Buttons |
|---|---|---|
| Link entity | Search (name, alias, LEI, BIC) with results (legal name, country, LEI, current group), loading state. Non-blocking "GLEIF parent LEI <value> differs from the group parent LEI <value>". If in another group: "Move <entity> from <old group> to <new group>?" | "Link entity"; "Move entity" |
| Unlink | "Unlink <entity> from <group>? It becomes a standalone entity. Its roles, contracts and products stay unchanged." | "Unlink entity", "Cancel" |
| Create / Edit group | Group name (required, max 200, unique after normalisation: "A group with this name already exists"), Parent LEI (optional, ISO 17442 check "LEI must be 20 letters or digits and pass the ISO 17442 check", GLEIF lookup; GLEIF unavailable saves with "Not verified with GLEIF"), Headquarters country (required) | "Create group" / "Save group", "Cancel" |
History: "Linked to group <group> by <user>"; "Moved from <group A> to <group B>" (old group counts update). Create group from Details tab or Search opens the new group record after saving.

**States:** Empty "No entities linked yet" (+ "Link entity" for Ops). Loading skeleton table. Save error "Changes were not saved. Try again." (values kept). Read-only "Owned by Ops". Deleted members hidden from table and counts.

**ACs:** M4 AC1 to AC6, AC12, AC13, AC16, edge cases 1 to 6; M1 AC18; M16 AC10, edge case 4; M15 AC3; resolution 24.

---

### 6.12 Admin (S7)

**Release:** R1 with Deleted records, Roles & permissions and Reset demo data; R2 adds Users & roles (7.6.6).

**Access:** one "Admin" menu entry. Admin (Adrian Koh, Ops; "View as" Ops): Users & roles, Deleted records, Roles & permissions, and "Reset demo data" at the end of the sub-navigation when `DEMO_MODE` is on. Compliance: Roles & permissions only. Others: no menu; opening any `/admin/*` page shows "You don't have access to Admin. Ask Adrian Koh (Ops)." and the API returns 403. Layout: top bar, left sub-navigation (tabs above content at 1024px), page content.

**Reset demo data** (admin, `DEMO_MODE` only; endpoint 404 otherwise): dialog "Reset all demo data? Every change made since the last reset is lost." On confirm reload seed, recompute seed dates as offsets from today, return every user to Home (M16 AC16).

#### 6.12.1 Users & roles, `/admin/users` (admin only)

**Release:** R2 (whole page). In R1 the Admin menu has no "Users & roles" entry.

- Layout: title + "Add user"; search "Search by name or email"; users table; note "Roles are fixed. Edit rights follow the ownership matrix." with link "View ownership matrix" (→ 6.12.3); "Change history" panel.
- Columns: Name, Email, Team (dropdown for admin; options Sales, Ops, CS, Network, Compliance, Finance, fixed in code), Admin (read-only "Yes" badge `#CBA135`, else empty). Admin flag is never editable in the UI.
- Seed (all active): Tom Hadley Sales; Michael Reed Sales; Adrian Koh Ops (Admin); Kevin Lim Ops; Emma Wilson CS; Leo Martin CS; Sophie Mitchell CS; Ethan Brooks CS; Lukas Brenner Network; Nora Lee Network; Mei Chen Compliance; Rachel Wong Finance. Emails `first.last@corvane.example`. Seed one team change: Nora Lee, Customer Success → Network, 30 days before demo day.
- Change team dialog: "Change <name>'s team from <old> to <new>? His edit rights change immediately." Buttons "Change team", "Cancel". On save: audit entry object User, field Team, old, new, actor admin; shown in Change history; next request evaluated with new rights. Failure: dropdown reverts, "Couldn't change team. Try again". Admin changing own team: blocked, "The admin must stay on the Ops team in this version."
- Add user dialog: Name, Email, Team (all required; "Enter a valid email address"; duplicate "A user with this email already exists"). Button "Add user".
- Change history panel (read-only, newest first, 50 + "Load more"): every team change and every added user: "<timestamp with offset> · <user> · <old team> → <new team> · <changed by>", e.g. "02 Oct 2026 11:20 (UTC+03:00) · Michael Reed · Sales → Finance · Adrian Koh"; added user rows show "(none) → <team>". Empty "No team changes yet".
- States: only admin exists "Only you have access. Add a colleague."; loading skeleton rows.
- ACs: M15 AC1, AC2, AC5, AC6, AC12, AC14, states, edge case 1; resolutions 3, 6, 56.

#### 6.12.2 Deleted records, `/admin/deleted-records` (admin only)

**Release:** R1 with the list and Reactivate, blocked when another active entity holds the LEI (guard 5, 7.6.9); R2 adds reactivation with a reused LEI (M16 AC15).

- Layout: title; search "Search by name or LEI"; table sorted by deleted at, newest first.
- Columns: Entity name (opens the deleted record read-only), LEI, Country, Roles, Deleted by, Deleted at, Reason, action "Reactivate".
- Seed row: "Lloyds Bank (legacy import) · H7FNTJ4851HG0EXQ1Z70 · GB · Customer · Adrian Koh · 18 Sep 2026 · Duplicate of Lloyds Bank plc (LEI H7FNTJ4851HG0EXQ1Z70)". Scenario 3 adds Monzo Bank Ltd with reason "Created twice during the CRM import".
- Soft delete hides the entity and child data from search, every worklist, Obligations view, group lists and "To pick up"; nothing is removed or changed in the database (M16 AC10). Duplicate check in the wizard also checks deleted records: "A deleted record with this LEI exists. Ask the admin to reactivate it." (non-blocking).
- Reactivate confirmation: "Reactivate <name>? All its data returns to search and worklists." Buttons "Reactivate", "Cancel". Effect: marker cleared; entity and children return exactly as before, including owner, products, stages and pending handoffs (both handoff types return as Sent); audit "Record status · Deleted · Active"; row leaves list; no owner notification re-sent.
- Reactivate with reused LEI (another active entity holds it): dialog adds the duplicate warning "<entity> already uses this LEI. Both records will stay active." with the active record's legal name, country, owner and "Open record", plus required reason 10 to 500 chars. On confirm both stay active; reason written to audit and to History on the reactivated record.
- Hard delete: no control, no endpoint.
- States: empty "No deleted records"; loading skeleton rows; error "Action not completed. Try again" (record unchanged).
- ACs: M16 AC8 to AC15, edge cases 3, 4, 6; M15 AC2, AC3; resolutions 39, 57.

#### 6.12.3 Roles & permissions, `/admin/roles-permissions` (Compliance and admin)

**Release:** R1 (complete, decision B10).

- Layout: title "Roles & permissions", line "Generated from the permission matrix the server enforces. Read-only." Legend chips "E Edits", "R Reads", "add Adds notes", "hidden", "none". Full-width table, sticky header and first column, rows grouped under Entity, Products and onboarding, Contacts, Partner, Compliance, Billing, Collaboration, Admin; columns Sales, Ops, Customer Success, Network, Compliance, Finance. At 1024px table scrolls inside its card with data area pinned; the page never scrolls horizontally.
- Cells: "E" on `--color-selected` fill labelled "Edits"; "R" secondary text "Reads"; "add"; "hidden" and "none" muted. Conditional cells carry a short note ("E at creation (wizard)"). Nothing clickable; no edit, no export.
- **Must render from the same matrix constant the server enforces** (M15 AC3, AC9, AC13). Content:

| Data area | Sales | Ops | Customer Success | Network | Compliance | Finance |
|---|---|---|---|---|---|---|
| Create customer (wizard) | E | none | none | none | none | none |
| Entity core (legal name, aliases, type, country, LEI, BICs) | E at creation (wizard) | E | R | R | R | R |
| Roles and lifecycle state (Inactive) | R | E | R | R | R | R |
| Customer role: contract reference | R | E | R | R | R | R |
| Customer role: renewal date | R | R | E | R | R | R |
| Customer role: handoff summary and SLAs | E | R | R | R | R | R |
| Commercial terms | E | R | R | R | R | E |
| Product lines and target go-live | E | E | R | R | R | R |
| Onboarding stages and blocks | R | E | R | R | R | R |
| Contacts: Champion, Decision maker (Customer context) | E | R | E | R | R | R |
| Contacts: Technical, Incident, Escalation (Customer context) | R | E | R | R | R | R |
| Contacts: all roles except Billing (Partner context) | R | R | R | E | R | R |
| Contacts: Billing | R | R | R | R | R | E |
| Partner coverage and connection method | R | R | R | E | R | R |
| Partner agreement reference | R | E | R | R | R | R |
| Group structure | R | E | R | R | R | R |
| KYB checks and periodic review | R | R | R | R | E | R |
| Contractual obligations | R | R | R | R | E | R |
| Billing profile | R | R | R | R | R | E |
| History notes | add | add | add | add | add | add |
| Owner reassignment | R | R | E | R | R | R |
| Handoff Sales → Ops | E (send, change Onboarding Manager) | E (confirm pickup) | R | R | R | R |
| Handoff Ops → CS | R | E (send, cancel) | E (accept, decline) | R | R | R |
| Audit log | hidden | hidden (visible to the admin) | hidden | hidden | R | hidden |
| Soft delete and reactivation | none | admin only | none | none | none | none |
| Users & roles (incl. Change history), Deleted records | none | admin only | none | none | none | none |
| Reset demo data (`DEMO_MODE` only) | none | admin only | none | none | none | none |
| Roles & permissions page | hidden | hidden (visible to the admin) | hidden | hidden | R | hidden |
| Issues: report, add to existing issue, issue notes | E | E | E | E | E | E |
| Issue owner actions (acknowledge, status, resolve, severity, type, contributors, reassign, linked issues) | E (issue owner only) | E (issue owner only) | E (issue owner only) | E (issue owner only) | E (issue owner only) | E (issue owner only) |
| Issue communicator actions (notifications, updates, close) | E (current communicator only) | E (current communicator only) | E (current communicator only) | E (current communicator only) | E (current communicator only) | E (current communicator only) |
| Compliance assessment on an issue | R | R | R | R | E | R |

- Notes under table: "The admin flag (Adrian Koh, Ops) adds Users & roles, Deleted records, Roles & permissions, the Audit tab and Reset demo data. It adds no edit rights on data." and "In the Partner context every contact role is owned by Network, except Billing, which Finance owns."
- States: loading skeleton with 6 team columns; error "Couldn't load the permission matrix. Retry"; always read-only. Other teams: "You don't have access to Admin. Ask Adrian Koh (Ops)."; a "View as" switch to such a team while on this page opens Home with toast "You don't have access to that page as <team>".
- ACs: M15 AC1, AC3, AC4, AC9, AC12, AC13; decision P4; resolutions 48, 59.

---

#### Conflicts resolved
- Audit filter by object (scenario decision 6) vs S4.8 filter bar with Field only: kept M16 AC6 filters and labelled Field options "<Object> · <Field>" so "KYB: Licence · Expiry date" is selectable.
- Change history scope: S7.1 lists team changes only; M15 AC14 (higher authority) also lists added users, so added users appear as "(none) → <team>".
- Reactivation with reused LEI: S7.2 gives only a warning line; M16 AC15 adds the active record's legal name, country, owner, "Open record" and History entry on the reactivated record; merged both.
- Effective date on coverage: M5 AC6/AC17 allow up to 30 days ahead on Add; Change status keeps "max today" per S4.5.
- Group record, Deleted records and Roles & permissions routes follow decision B5: `/groups/[id]`, `/admin/deleted-records`, `/admin/roles-permissions`.
- Seed team change: scenario decision 6 (Nora Lee, CS → Network) supersedes the Michael Reed example, which stays as dialog copy illustration only.


### 6.13 Issue flow screens (S8), milestones 6B and 6C

**Release:** R1 for everything below except the items marked R2 (milestone 12A). Not implemented until the PO says so (decision B15).

**Design source:** design brief section 6 "Screens (part 3): issue flow" give layout, visual hierarchy and every copy string; this section gives routes, data, permissions and component reuse. Where they differ on behaviour, this brief and Appendix B win (section 0). Times on every issue screen display in the viewer's effective time zone with its abbreviation (4.9.5).

#### 6.13.1 Screens and routes

| Screen | Route | Opened from | Milestone | ACs |
|---|---|---|---|---|
| Entity record, Issues tab (S4.10) | `/entities/[id]/issues` | Tab bar (after History), header "Report issue" | 6B | M17 screens, AC10, empty state |
| Report issue panel (S8.1) | `/entities/[id]/issues?report=1`, `/groups/[id]?report=1` | "Report issue" in the entity header, the Issues tab and the group record header | 6B | M17 AC1 to AC13 |
| Issue page (S8) | `/issues/[issueId]`, for example `/issues/ISS-1042` | Issues tab rows, Home Issues rows, History "Incident" events, linked and related issue links | 6B (partner panels and Compliance block 6C) | M18 AC9, M19, M21, M22, M23, M25, M26 AC8 |
| Home "Issues" section | `/` | S0 Home link | 6C | M20 |
| Details tab, "Issue team" block | `/entities/[id]/details#issue-team` | Issue page "Why this owner" link | 6A (read-only) | M18 AC3 |
| Compliance tab, "Regulatory" block on the Customer agreement card | `/entities/[id]/compliance#customer-agreement` | Issue "Customer obligations" block, Compliance links | 6A | M26 |

The issue routes render inside the S0 shell. An unknown issue ID shows the S0 not-found page. An issue on a soft-deleted entity follows the deleted-record page rule (3.2.6.3).

#### 6.13.2 Entity Issues tab (S4.10)

- Table of the entity's issues, open first, then newest first: ID, severity chip, type, scheme and country, status, owner, communicator, next deadline with its clock text for open issues, Corvane aware at. Row opens the Issue page.
- Toolbar: "Report issue" (all 6 teams; hidden on a soft-deleted entity, stays available on an Inactive entity, M17 edge case 7) and a filter "Open / All".
- Empty: "No issues reported on this entity" with "Report issue". Loading: three skeleton rows. Error: "This section could not be loaded. Retry."

#### 6.13.3 Report issue panel (S8.1)

- Right-side panel 560 px over the entity or group record (the Add note drawer pattern of 6.6; full-height overlay at 1024 px). Title "Report issue".
- Fields in the order of M17 AC2. The entity field is read-only on an entity record; on a group record it lists the active member entities as checkboxes, none ticked (M17 AC4). The product line select shows "<product> / <country>, <stage>" and locks scheme and country when chosen; it is hidden on partner-only entities, where scheme and country list the coverage rows first. "Reported at the customer by" lists active contacts (Incident contacts first), then "Someone else" with a name field, then "Found by Corvane".
- Live blocks under the fields, from `GET /api/entities/{id}/issue-context` and the shared `proposeSeverity()` (4.9.4): "Proposed severity: <Sev-n> (<rule>)" and the cap line; "Open issues on <entity>, <scheme> <country>" (M17 AC5) with "Add to existing issue" per row and its confirm dialog "Add your report to ISS-1038? No new issue will be created."
- Buttons "Cancel" and "Report issue" (spinner and disabled while saving). On success the Issue page opens with the banner "Issue ISS-<n> reported" (group report: the banner lists every new ID).
- Validation and copy: 3.4.3. States: M17 States (similar-issues skeleton and "Couldn't check for open issues. Retry"; "Issue not reported. Try again."; routing failure "Issue not reported: no owner could be found. Try again or contact the admin.").

#### 6.13.4 Issue page (S8)

Regions, top to bottom (layout per design brief section 6; reference artboard "Issue-ISS-1042-Handover", design brief 6.9):

| Region | Content | Who acts | ACs |
|---|---|---|---|
| Banners | Confirmation after save; "Clocks start <time>, the start of <Team> business hours" (rule 4); "Linked to <ID>" and, on a dual-role entity, "This entity is also the affected partner" with the latest partner communication; "Severity raised after notification. Tell the customer in the next update"; US alert; Degraded proposal (partner issue) | Network on the proposal | M18 AC6, AC9, M19 edge case 1, M22 edge case 6, M23 AC4, AC9 |
| Header | ID, severity chip with the cap label, type, status, entity link with scheme and country, Corvane aware at, reporter; "Owner", "Communicator" (with the interim line of 4.9.7), "Contributors"; the one visible deadline; "Why this owner" with a link to the Issue team block; "Copy for the customer". Actions: "Acknowledge" (primary, owner, New), "Change status" (disabled with "Acknowledge the issue first" while New), "Reassign issue", "Change severity", "Change type" for the owner; "Close" for the communicator on a Resolved issue | Owner, communicator | M18 AC9, M19 AC12, AC13, AC17, M21 AC1 to AC3, AC8, M22 AC11 |
| Description | Text with "Edit" for the reporter while New | Reporter | M17 AC11 |
| Clocks panel | One row per clock with start, target, due, stop and state (4.9.5) | none | M19 AC12 |
| Communication | Incident contact block, prefilled message with "Copy message" and "Open in Gmail", "Record notification", communication log newest first (system entries grey) | Communicator | M22 AC2 to AC8 |
| Resolution | Root cause and solution; superseded resolutions marked "Superseded" | Owner | M21 AC4, AC5 |
| People panel | Owner, communicator, contributors with "Add contributor" and remove; each person with their local time and the chip "In hours" or "Out of hours" (3.3.5) | Owner | M21 AC6 |
| Customer obligations | Read-only block of M26 AC8 | none | M26 AC8 |
| Compliance block | Flag reasons, assessment clock, "Record assessment", assessment history | Compliance | M25 |
| Partner panels (partner issue) | "Affected customers (<n>)" with "Not affected: before go-live (<n>)"; "Linked issues (<n>)" with "Customers notified <n> of <m>"; "Create linked issues" | Owner of the partner issue | M23 AC5 to AC10, AC13 |
| Related issues | Issues of the same group report; R2 "Related to <ID>" | none | M17 AC4, M22 AC16 |
| Notes | "Internal notes. Never sent to the customer", "Add note", newest first | All teams | M21 AC7 |
| Root cause report (R2) | Task, deadline, "Record report sent" | Owner | M27 |

#### 6.13.5 Dialogs

| R1 | R2 |
|---|---|
| Add to existing issue (confirm); Change severity; Change type; Change status; Resolve issue (with the cascade confirmation "Resolve <ID> and <n> linked issues?" on a partner issue); Back to In progress with reason; Reassign issue (with the outside-business-hours warning of M21 AC10); Add contributor; Remove contributor (confirm "Remove <name> as contributor?"); Record notification; Close issue; Record assessment; Create linked issues; Unlink; M5 Change status prefilled from the Degraded proposal | Reopen issue; Take over communication; Record report sent |

All dialogs use the Dialog component of 5.1.6 (modal 520 px, values kept on a failed save with the story's "... not saved. Try again." copy).

#### 6.13.6 Home "Issues" section

Section card first on Home (5.3), title "Issues (<n>)", main rows then the "Contributing" and "Reported by me" headings. Main row: severity chip, ID and type, entity and country, scheme and country, status, role label, next step with its clock text and "+1 more step", "Open". Rows are read-only (M20 AC12). Rules: 4.6.9.

#### 6.13.7 Blocks on existing tabs

- **Details, "Issue team" (M18 AC3):** read-only card for every team: Customer owner (from the owner block), Sales, Ops, Network, Finance, Compliance with name and team; the Sales line shows "Tom Hadley (Sales Director, fallback)" when the creating Sales user is inactive. Under the names, "On-call this week" lists the on-call person of Ops, Network and Compliance, plus the line "Sales and Finance: no on-call". Empty: "Issue team not set". Editing is phase 2.
- **Compliance, Customer agreement card, "Regulatory" block (M26):** fields and helper texts of M26 AC2, AC3; own counter "<n> of 3 captured" (R1) or "of 4" (R2); edited with the card's existing "Edit" (Compliance), read-only with "Owned by Compliance" for the others. The M13 counter keeps counting its 8 fields. "Post-incident report due (days)" is not rendered in R1 (M26 AC9).

#### 6.13.8 Component reuse

| New element | Built from |
|---|---|
| Report issue panel | Drawer of the Add note drawer (6.6), form controls of 5.1.6, contact picker of the Add note participants |
| Severity chip | Chip variants of 5.1.5: Sev-1 danger, Sev-2 due (orange), Sev-3 and Sev-4 neutral |
| Clock text | New `ClockText` client component: server due time + `serverNow` offset, refresh every 60 s, red when overdue |
| Incident contact block | The S4.0 incident contact block (6.1) with a `context` prop (Customer or Partner) |
| Communication log and notes | Timeline event and note cards of 6.6 (system entries use the event card style) |
| Home rows | Worklist row of 5.3 with the issue columns; section card, skeleton and error patterns of 5.3 |
| Affected customers and linked issues | Table and chip components of 5.1.6, collapse pattern of "Former contacts" (6.5) |
| Dialogs, toasts, banners, "Owned by" lock | 5.1.6, 5.1.7, 5.2 |

#### 6.13.9 States

Every issue screen implements the States block of its story in Appendix B (M17 to M23, M25 to M27): empty, loading (skeletons, action buttons disabled until the issue loads), error ("Couldn't load this issue. Retry", "Action not saved. Try again."), read-only (non-owners and non-communicators see everything with "Add note" only; Closed issues read-only except "Add note" and R2 "Reopen").

**ACs:** M17 AC1 to AC13; M18 AC3, AC6, AC9, AC10; M19 AC12, AC13, AC17; M20 AC1 to AC13; M21 AC1 to AC12; M22 AC1 to AC12, AC18, AC19; M23 AC1 to AC17; M25 AC1 to AC8; M26 AC1 to AC8; R2 parts in milestone 12A.

---

## 7. Seed data, demo mode, tests and build plan

This section gives Claude Code one dataset that serves all 4 demo scenarios in any order, the demo-mode mechanics, the test plan and the build order. Every date is an offset from the demo day: `today-12` means 12 calendar days before "today" in Europe/Bucharest (M11 AC2). Worked dates in brackets assume the reference day Friday 02 Oct 2026, the same day every example in Appendix A uses.

---

### 7.1 Seed data

#### 7.1.0 How the seed is built

- **Files.** `prisma/seed/data/*.ts` hold the tables below as typed constants (file list in 3.1.1). `prisma/seed/seed.ts` exports `seed(db, today)`, which writes them; `prisma/seed/index.ts` is the CLI entry. `npm run db:reset` runs `scripts/db-reset.ts` (migrate reset, `prisma/grants.sql`, seed; 3.1.5). "Reset demo data" (7.2.3) calls the same `seed()` function.
- **Clock.** All offsets resolve through `src/lib/dates.ts` (3.1.1): `today()` returns the date in Europe/Bucharest, `now()` returns the instant; `prisma/seed/dates.ts` builds the seed helpers on it. Helpers: `d(-12)` gives a date-only value, `ts(-12, "10:00")` gives a timestamp at 10:00 Europe/Bucharest, stored in UTC. Seeded timestamps use 10:00 unless a table gives a time. When `DEMO_CLOCK_START` is set (tests only, 7.2.1), the clock starts there.
- **Writes bypass permission checks and nothing else.** The seed writes rows directly through the owner database connection (7.2.1). It uses the same formatters as the service layer to produce the derived rows: one `AuditEntry` per field on every seeded create or change (M16 AC1, AC2), and the matching `HistoryEvent` rows (M10 AC5), each with the seeded actor, the actor's team at that time and the seeded timestamp.
- **Stage history.** For each product line, the seed writes one stage-change row per stage passed, from `Contract signed` to the current stage. Rows for stages with a date in the tables below use that date. Stages with no given date get dates spread evenly between the neighbouring given dates, rounded to whole days, actor Adrian Koh (Ops) unless the table says otherwise. Each row produces its History event and audit entries.
- **Computed values.** Lifecycle state is a stored derived column (3.2.4): the seed computes it with `derived/lifecycle.ts` (M6 AC12, decision B1) and stores Inactive only where the table says so. KYB chip status (M12 AC8), periodic review Overdue (M12 AC12), "Incomplete for billing" (M14 AC7) and every worklist (M11 AC2) are computed at read time. The "Expected" columns below are test oracles, not columns.
- **Display names.** Entities use the display names below (sentence case as in the conventions table). The LEI KYB check stores the raw GLEIF values. "Refresh from GLEIF" never overwrites `legalName`.
- **GLEIF values at seed time.** The LEI KYB check of every seeded entity takes its GLEIF registration status, next renewal date and fetch time from the GLEIF client with `GLEIF_SEED_SOURCE` (7.2.1): live with cache fallback for the demo, cache only for tests.
- **Volume.** 18 entity rows: 17 active (16 visible in default search plus 1 Inactive) and 1 soft-deleted. Santander Consumer Bank GmbH is the 19th, created live. This meets "15 to 25 entities" (Part 1 3.1).

#### 7.1.1 Users

All active (resolution 6). Emails `first.last@corvane.example`, lowercase, ASCII. `createdAt` = `today-400` for all, with a "User added" audit entry each (actor Adrian Koh) so the Change history panel is populated (M15 AC14).

| Key | Name | Email | Team (current) | Admin | In "View as" | Notes |
|---|---|---|---|---|---|---|
| tom | Tom Hadley | tom.hadley@corvane.example | SALES | no | Sales | Creator of most scenario customers |
| michael | Michael Reed | michael.reed@corvane.example | SALES | no | no | Creator of Revolut, Monzo, Portugal and fillers |
| adrian | Adrian Koh | adrian.koh@corvane.example | OPS | **yes** (only admin) | Ops | M15 AC2 |
| kevin | Kevin Lim | kevin.lim@corvane.example | OPS | no | no | Second Onboarding Manager (resolution 3) |
| emma | Emma Wilson | emma.wilson@corvane.example | CS | no | Customer Success | |
| leo | Leo Martin | leo.martin@corvane.example | CS | no | no | Owner of Adyen |
| sophie | Sophie Mitchell | sophie.mitchell@corvane.example | CS | no | no | |
| ethan | Ethan Brooks | ethan.brooks@corvane.example | CS | no | no | Owner of Monzo |
| lukas | Lukas Brenner | lukas.brenner@corvane.example | NETWORK | no | Network | |
| nora | Nora Lee | nora.lee@corvane.example | NETWORK | no | no | Team change CS → Network on `today-30` |
| mei | Mei Chen | mei.chen@corvane.example | COMPLIANCE | no | Compliance | |
| rachel | Rachel Wong | rachel.wong@corvane.example | FINANCE | no | Finance | |

**Team change (scenario decision 6).** Nora Lee is created with team CS at `today-400`. At `ts(-30, "11:20")` Adrian Koh changes her team to Network: one `AuditEntry` (object "User: Nora Lee", field Team, old CS, new Network, actor Adrian Koh, team Ops). The Change history panel shows it first. Nora Lee performs no action in the seed while she was in CS that a CS user could not do.

**Contracting Corvane entities (configuration, M14 AC1):** `["Corvane Singapore Pte. Ltd.", "Corvane Europe B.V."]`.
**Approved storage hosts (configuration, M12 AC7):** `["docs.corvane-internal.example"]`.
**Time zones (issue flow, milestone 6A):** 7.1.17.1.

#### 7.1.2 Groups

| Key | Name | Parent LEI | Parent legal name (GLEIF) | HQ country | Created | Members (seed) |
|---|---|---|---|---|---|---|
| santander | Santander | 5493006QMFDDMYWIAM13 | BANCO SANTANDER S.A. | ES | `today-270` by Adrian Koh | santanderUk, totta, scbIt, scbPt |

Banco Santander S.A. has no entity record (resolution 2). No other group is seeded: GLEIF reports UniCredit S.p.A. (549300TRUWO2CD2G5692) as HVB's parent, and M2 edge case 3 needs "no group has that LEI" to stay true. Every other entity has `groupDecision = STANDALONE`, confirmed at creation, so "Group not set" never fires in the seed.

#### 7.1.3 Entities

Type enum `BANK | FINTECH | PSP`. Roles: C = Customer, P = Network partner. "Created" is the creation date and the Sales creator (M2 AC14, used by the Sales worklist scope). "Owner since" is the date the current owner took over.

| Key | Display legal name | Type | Country | LEI | BICs | Aliases | Roles | Group | Created (by) | Owner (since) | Inactive | Expected lifecycle |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| santanderUk | Santander UK plc | BANK | GB | PTCQB104N23FMNK2RZ28 | ABBYGB2LXXX | | C | santander | `today-262` (Tom) | Sophie Mitchell (`today-140`) | no | BAU |
| totta | Banco Santander Totta, S.A. | BANK | PT | 549300URJH9VSI58CS32 | TOTAPTPLXXX | | C, P | santander | `today-257` (Tom) | Adrian Koh (`today-255`) | no | Live |
| scbIt | Santander Consumer Bank S.p.A. | BANK | IT | 549300O0YQXDOJB36Y73 | FICUITTTXXX | | C | santander | `today-237` (Tom) | Emma Wilson (`today-45`) | no | Live |
| scbPt | Banco Santander Consumer Portugal S.A. | BANK | PT | 549300Z5VU00GHU3B005 | | | C | santander | `today-3` (Michael) | Michael Reed (`today-3`) | no | Onboarding |
| lloyds | Lloyds Bank plc | BANK | GB | H7FNTJ4851HG0EXQ1Z70 | LOYDGB2LXXX | Lloyds TSB Bank plc | C, P | standalone | `today-400` (Tom) | Adrian Koh (`today-399`) | no | Live |
| mps | Banca Monte dei Paschi di Siena S.p.A. | BANK | IT | J4CP7MHCXR8DAQMKIL78 | PASCITMMXXX | MPS | C | standalone | `today-380` (Tom) | Emma Wilson (`today-150`) | no | Live |
| zopa | Zopa Bank Limited | FINTECH | GB | 213800QW7QJVVCL9RZ56 | ZOPAGB21XXX | Zopa Financial Services | C | standalone | `today-60` (Tom) | Kevin Lim (`today-58`) | no | Onboarding |
| hvb | UniCredit Bank GmbH | BANK | DE | 2ZCNRR8UK83OBTEK2170 | HYVEDEMMXXX | HVB | C | standalone | `today-500` (Tom) | Emma Wilson (`today-1`) | no | BAU |
| adyen | Adyen N.V. | PSP | NL | 724500973ODKK3IFQ447 | | | C, P | standalone | `today-720` (Tom) | Leo Martin (`today-200`) | no | BAU |
| revolut | Revolut Ltd | FINTECH | GB | 213800MQORWPL582SW82 | REVOGB21XXX | | C | standalone | `today-200` (Michael) | Adrian Koh (`today-199`) | no | Live |
| monzo | Monzo Bank Ltd | FINTECH | GB | 213800PLUYXGZ8LU7T61 | MONZGB2LXXX | | C | standalone | `today-30` (Michael) | Ethan Brooks (`today-20`) | no | Onboarding |
| nordea | Nordea Bank Abp | BANK | FI | 529900ODI3047E2LIV03 | NDEAFIHHXXX | | C | standalone | `today-262` (Michael) | Sophie Mitchell (`today-150`) | no | BAU |
| ingdiba | ING-DiBa AG | BANK | DE | 3KXUNHVVQFIJN6RHLO76 | INGDDEFFXXX | | C, P | standalone | `today-225` (Michael) | Ethan Brooks (`today-120`) | no | BAU |
| ocbc | Oversea-Chinese Banking Corporation Limited | BANK | SG | 5493007O3QFXCPOGWK22 | OCBCSGSGXXX | OCBC | P | standalone | `today-110` (Adrian, partner record) | **No owner** | no | Live (partner-only, coverage Active, B1) |
| boi | The Governor and Company of the Bank of Ireland | BANK | IE | Q2GQA2KF6XJ24W42G291 | BOFIIE2DXXX | Bank of Ireland | P | standalone | `today-70` (Adrian, partner record) | Kevin Lim (`today-70`) | no | Live (partner-only, coverage Active, B1) |
| ceska | Česká spořitelna, a.s. | BANK | CZ | 9KOGW2C2FCIOJQ7FF485 | GIBACZPXXXX | | C | standalone | `today-10` (Michael) | Kevin Lim (`today-9`) | no | Onboarding |
| rbi | Raiffeisen Bank International AG | BANK | AT | 9ZHRYM6F437SQJ6OUG95 | RZBAATWWXXX | RBI | C | standalone | `today-600` (Michael) | Sophie Mitchell (`today-400`) | **yes**, set by Adrian Koh on `today-60`, reason "Contract terminated by the customer" | Inactive |
| lloydsLegacy | Lloyds Bank (legacy import) | BANK | GB | H7FNTJ4851HG0EXQ1Z70 | | | C | standalone | `today-40` (Michael) | Michael Reed (`today-40`) | no | **Soft-deleted** by Adrian Koh at `ts(-14, "16:40")`, reason "Duplicate of Lloyds Bank plc (LEI H7FNTJ4851HG0EXQ1Z70)" |

Notes:
- The 11 entities of the Resolution log table plus Santander Consumer Bank GmbH (created live) carry the scenarios. The 6 fillers (nordea, ingdiba, ocbc, boi, ceska, rbi) make search, filters and worklists look populated and exercise edge states: partner-only (Products tab hidden, M6 AC20), "No owner" (M9 AC2, search "No owner" filter), Inactive (M1 AC10, M11 AC21). All filler LEIs were read from GLEIF on 03 Oct 2026, registration ISSUED, renewal dates 2027-02-10 or later.
- Partner records ocbc and boi have no Sales creator: `createdBy` is Adrian Koh and the creation History event reads "Record created by Adrian Koh (Ops)". No worklist reads their creator.
- **Santander Consumer Bank GmbH (5299000I7Y60A8273788, AT) is not in the seed.** Its GLEIF record is in the cache (7.2.4).
- The legacy Lloyds record shares the Lloyds LEI on purpose: it feeds the deleted-record LEI warning (M16 edge case 3) and the reactivation conflict (M16 AC15) in Q&A.

#### 7.1.4 Customer role cards (Details tab)

| Entity | Contract reference | Renewal date | Handoff summary (Sales) | Commercial terms (Sales and Finance) |
|---|---|---|---|---|
| santanderUk | IPE-MSA-2026-014 (group master) | `today+300` | SLA 99.95 %, max response 800 ms | GBP, 0.0350 / verification, tiers 0-1,000,000 at 0.0350 and 1,000,001-open at 0.0300, minimum 2,000, 30 days |
| totta | IPE-MSA-2026-014 (group master) | `today+270` | SLA 99.95 % | EUR, 0.0400, no tiers, minimum 1,500, 30 days |
| scbIt | IPE-IT-2026-022 (entity) | `today+200` | SLA 99.90 %, special terms "Pilot pricing for first 3 months in IT" | EUR, 0.0420, no tiers, 45 days |
| scbPt | IPE-MSA-2026-014 (group master) | none | Notes for Onboarding "Group MSA applies. LEI renewal pending at GLEIF, Compliance informed." | EUR, 0.0400, no tiers, 30 days |
| lloyds | IPE-GB-2025-007 (entity) | `today+400` | SLA 99.95 %, max response 1,000 ms | GBP, 0.0300, tiers 0-2,000,000 at 0.0300 and 2,000,001-open at 0.0250, minimum 3,000, 30 days |
| mps | IPE-IT-2025-003 (entity) | `today+75` | SLA 99.95 %, other SLA "Monthly service report by the 5th business day" | EUR, 0.0380, tiers 0-500,000 at 0.0380 and 500,001-open at 0.0320, minimum 1,000, 60 days |
| zopa | **none** ("No contract attached") | `today+330` | SLA 99.90 % | GBP, 0.0450, no tiers, 30 days |
| hvb | **none** ("No contract attached") | `today-10` | SLA 99.90 % | EUR, 0.0400, no tiers, 30 days |
| adyen | IPE-NL-2024-011 (entity) | `today+100` | SLA 99.90 % | EUR, 0.0450, no tiers, 30 days |
| revolut | IPE-GB-2026-002 (entity) | `today+250` | SLA 99.95 %, max response 500 ms, special terms "Weekly status call during EU VoP DE onboarding" | GBP, 0.0280, tiers 0-5,000,000 at 0.0280 and 5,000,001-open at 0.0220, minimum 5,000, 30 days |
| monzo | IPE-GB-2026-027 (entity) | `today+250` | SLA 99.90 % | GBP, 0.0300, no tiers, 30 days |
| nordea | IPE-FI-2026-004 (entity) | `today+260` | SLA 99.90 % | EUR, 0.0400, no tiers, 30 days |
| ingdiba | IPE-DE-2026-012 (entity) | `today+180` | SLA 99.90 % | EUR, 0.0380, no tiers, 30 days |
| ceska | IPE-CZ-2026-019 (entity) | `today+365` | SLA 99.90 % | EUR, 0.0400, no tiers, 30 days |
| rbi | IPE-AT-2025-006 (entity) | `today-60` | SLA 99.90 % | EUR, 0.0400, no tiers, 30 days |
| lloydsLegacy | none | none | none | none |

#### 7.1.5 Contract and partner agreement references (M4 AC9, AC11)

All document links are `https://docs.corvane-internal.example/<path>`.

| Contract ID | Title | Scope | Signing date | Invoiced entity | Applies to | Link path |
|---|---|---|---|---|---|---|
| IPE-MSA-2026-014 | Santander Group master services agreement | GROUP_MASTER_AGREEMENT | `today-270` | totta | santanderUk, totta, scbPt | santander/msa-2026-014.pdf |
| IPE-IT-2026-022 | Santander Consumer Bank S.p.A. local services agreement | ENTITY_CONTRACT | `today-240` | scbIt | scbIt | santander/scb-it-2026-022.pdf |
| IPE-GB-2025-007 | Lloyds Bank plc verification services agreement | ENTITY_CONTRACT | `today-410` | lloyds | lloyds | lloyds/customer-2025-007.pdf |
| IPE-IT-2025-003 | MPS verification services agreement | ENTITY_CONTRACT | `today-385` | mps | mps | mps/customer-2025-003.pdf |
| IPE-NL-2024-011 | Adyen services agreement | ENTITY_CONTRACT | `today-725` | adyen | adyen | adyen/customer-2024-011.pdf |
| IPE-GB-2026-002 | Revolut Ltd verification services agreement | ENTITY_CONTRACT | `today-210` | revolut | revolut | revolut/customer-2026-002.pdf |
| IPE-GB-2026-027 | Monzo Bank Ltd verification services agreement | ENTITY_CONTRACT | `today-32` | monzo | monzo | monzo/customer-2026-027.pdf |
| IPE-FI-2026-004 | Nordea Bank Abp services agreement | ENTITY_CONTRACT | `today-265` | nordea | nordea | nordea/customer-2026-004.pdf |
| IPE-DE-2026-012 | ING-DiBa AG services agreement | ENTITY_CONTRACT | `today-228` | ingdiba | ingdiba | ingdiba/customer-2026-012.pdf |
| IPE-CZ-2026-019 | Česká spořitelna services agreement | ENTITY_CONTRACT | `today-12` | ceska | ceska | ceska/customer-2026-019.pdf |
| IPE-AT-2025-006 | Raiffeisen Bank International services agreement | ENTITY_CONTRACT | `today-605` | rbi | rbi | rbi/customer-2025-006.pdf |

| Partner agreement ID | Entity | Title | Signing date | Link path |
|---|---|---|---|---|
| IPE-PA-2025-003 | lloyds | Lloyds Bank plc network partner agreement | `today-245` | lloyds/partner-agreement.pdf |
| IPE-PA-2025-009 | totta | Banco Santander Totta network partner agreement | `today-130` | santander/totta-partner-2025-009.pdf |
| IPE-PA-2024-011 | adyen | Adyen network partner agreement | `today-330` | adyen/partner-2024-011.pdf |
| IPE-PA-2026-015 | ingdiba | ING-DiBa network partner agreement | `today-160` | ingdiba/partner-2026-015.pdf |
| IPE-PA-2026-001 | ocbc | OCBC network partner agreement | `today-110` | ocbc/partner-2026-001.pdf |
| IPE-PA-2026-004 | boi | Bank of Ireland network partner agreement | `today-70` | boi/partner-2026-004.pdf |

Group record oracle (seed state, M4 AC2): "Entities 4", "Customer 3 · Network partner 0 · Both 1", "Contract signed 1 · Sandbox & technical integration 1 · UAT 1 · Ramp-up 2 · BAU 1", "Countries GB, PT, IT", "No contract attached 0". After scenario 1: "Entities 5", countries add AT, "No contract attached 1".

#### 7.1.6 Product lines and stages

Contracting entity = the entity itself on every line. "L&H" = date entered Live & hypercare ("Billable from", M6 AC11). "Added" is the line creation date; lines added after the wizard were added by Adrian Koh with "Add product line" (M6 AC18).

| # | Entity | Product / country | Added | L&H entered | Current stage | Entered current stage | Target go-live | Block | Expected worklist items |
|---|---|---|---|---|---|---|---|---|---|
| P1 | santanderUk | UK CoP / GB | `today-262` | `today-205` | BAU | `today-150` | `today-210` | | none |
| P2 | totta | EU VoP / PT | `today-257` | `today-90` | Ramp-up | `today-30` | `today-95` | | none |
| P3 | totta | EU VoP / FR | `today-120` (Adrian) | | Sandbox & technical integration | `today-38` | `today+60` | | Adrian "Too long in current stage" (38 days, limit 21) |
| P4 | scbIt | EU VoP / IT | `today-237` | `today-110` | Ramp-up | `today-50` | `today-115` | | none |
| P5 | scbIt | Global validation / IT | `today-60` (Adrian) | | UAT | `today-10` | `today+40` | | none |
| P6 | scbPt | Global validation / PT | `today-3` | | Contract signed | `today-3` | `today+59` | | none |
| P7 | lloyds | UK CoP / GB | `today-400` | `today-330` | BAU | `today-260` | `today-335` | | none |
| P8 | lloyds | Global validation / GB | `today-40` (Adrian) | | Sandbox & technical integration | `today-12` | `today+45` | | none (makes Lloyds eligible for "Required fields empty") |
| P9 | mps | EU VoP / IT | `today-380` | `today-200` | BAU | `today-120` | `today-205` | | none |
| P10 | mps | EU VoP / DE | `today-300` (Adrian) | `today-100` | Ramp-up | `today-40` | `today-105` | | none |
| P11 | mps | Global validation / DE | `today-300` (Adrian) | `today-25` | Live & hypercare | `today-25` | `today-30` | resolved: set `today-70` by Adrian, Blocked by Customer, "Waiting for the customer's firewall change for the DE endpoint", resolved `today-55` | none |
| P12 | zopa | UK CoP / GB | `today-60` | | UAT | `today-15` | `today-6` | | Tom "Overdue go-lives" (6 days late) |
| P13 | hvb | EU VoP / DE | `today-500` | `today-400` | BAU | `today-330` | `today-405` | | none |
| P14 | adyen | Global validation / NL | `today-720` | `today-560` | BAU | `today-480` | `today-565` | | none |
| P15 | revolut | UK CoP / GB | `today-200` | `today-60` | Live & hypercare | `today-60` | `today-65` | | Adrian "Too long in current stage" (60 days, limit 56) |
| P16 | revolut | EU VoP / DE | `today-200` | | UAT | `today-14` | `today+30` | **open**: Blocked by Customer since `today-8`, "waiting for production certificates from the customer's security team" | Adrian "Blocked" (8 days) |
| P17 | revolut | Global validation / SG | `today-150` (Adrian) | | Testing & certification | `today-10` | `today+9` | | Adrian "Go-lives in the next 14 days" (9 days) |
| P18 | monzo | Global validation / GB | `today-30` | | Kickoff | `today-9` | `today+50` | | none |
| P19 | nordea | EU VoP / FI | `today-262` | `today-235` | BAU | `today-220` | `today-240` | | none |
| P20 | ingdiba | EU VoP / DE | `today-225` | `today-200` | BAU | `today-180` | `today-205` | | none |
| P21 | ceska | Global validation / CZ | `today-10` | | Kickoff | `today-5` | `today+70` | | none |
| P22 | rbi | EU VoP / AT | `today-600` | `today-520` | BAU | `today-460` | `today-525` | | none (Inactive) |

No product line is cancelled in the seed. Every target go-live is on or after the contract signing date (M6 edge case 6).

#### 7.1.7 Partner roles and coverage (M5)

| Entity | Connection method | Provider | Coverage rows (scheme / country: status since, with status history oldest first) |
|---|---|---|---|
| lloyds | Direct | | UK CoP / GB: Onboarding `today-120` "Initial coverage" → Active `today-20` "Certification passed" (Lukas). Global validation / GB: Onboarding `today-240` → Active `today-200` "Go-live completed". Global validation / IE: Onboarding `today-15` "Initial coverage" |
| totta | Via scheme | | EU VoP / PT: Onboarding `today-130` → Active `today-90` "Go-live completed" |
| adyen | Via routing provider | ClearRoute Services | Global validation / NL: Onboarding `today-330` → Active `today-300`. EU VoP / NL: Onboarding `today-20` "Initial coverage" |
| ingdiba | Via scheme | | EU VoP / DE: Onboarding `today-160` → Active `today-150` |
| ocbc | Direct | | Global validation / SG: Onboarding `today-110` → Active `today-100` |
| boi | Via routing provider | ClearRoute Services | Global validation / IE: Onboarding `today-70` → Active `today-60` |

All coverage changes are by Lukas Brenner (Network). Expected Lloyds Overview counts before scenario 2: "Active 2, Onboarding 1"; after step 3: "Active 1, Degraded 1, Onboarding 1". No row is Degraded, Suspended, Retired or Scheduled in the seed. Only lloyds has UK CoP coverage.

#### 7.1.8 Contacts (fictional people)

Owning team is derived from context and role (M7 AC3, M15 AC4). `Verified` = `lastVerifiedAt` offset and verifier; "never" = null (seeded legacy contact). Phones are E.164. UK numbers use the Ofcom drama range +44 7700 900xxx. Emails use `<first>.<last>@<slug>.example` with the slugs given.

| Entity (email slug) | Ctx | Role | Name | Job title | Phone | Time zone | Availability | Primary | Status | Verified |
|---|---|---|---|---|---|---|---|---|---|---|
| santanderUk (santander-uk) | C | Champion | Oliver Bennett | Head of Payments Innovation | | | | | **Left** `today-12`, note "Moved to another bank" | `today-200` Tom |
| santanderUk | C | Technical | Grace Turner | Integration Lead | +447700900210 | Europe/London | | | Active | `today-150` Adrian |
| santanderUk | C | Incident | Daniel Price | Payments Operations Manager | +447700900211 | Europe/London | 24/7 | | Active | `today-150` Adrian |
| totta (santander-totta) | C | Champion | Inês Carvalho | Head of Digital Payments | | | | | Active | `today-60` Tom |
| totta | C | Technical | Rui Almeida | Integration Engineer | +351912345010 | Europe/Lisbon | | | Active | `today-35` Adrian |
| totta | C | Incident | Marta Sousa | Operations Lead | +351912345011 | Europe/Lisbon | 24/7 | | Active | `today-35` Adrian |
| totta | P | Technical | João Ferreira | Network Integration Lead | +351912345012 | Europe/Lisbon | | | Active | `today-120` Lukas |
| totta | P | Incident | Pedro Matos | Service Desk Manager | +351912345013 | Europe/Lisbon | Mon-Fri 08:00-20:00 | yes | Active | `today-30` Lukas |
| totta | P | Billing | Sofia Ribeiro | Accounts Payable | | | | | Active | `today-204` Rachel |
| scbIt (scb-it) | C | Champion | Federica Rinaldi | Head of Payments | | | | | Active | `today-40` Emma |
| scbIt | C | Technical | Marco Bellini | IT Architect | +393401234510 | Europe/Rome | | | Active | `today-50` Adrian |
| scbIt | C | Incident | Chiara Russo | Operations Manager | +393401234511 | Europe/Rome | 24/7 | | Active | `today-50` Adrian |
| scbPt (scb-pt) | C | Champion | Tiago Moreira | Head of Operations | | | | | Active | `today-3` Michael |
| lloyds (lloyds) | C | Champion | James Holloway | Director, Payments Partnerships | | | | | Active | `today-30` Tom |
| lloyds | C | Incident | Ruth Okafor | Payments Incident Manager | +447700900301 | Europe/London | 24/7 | | Active | `today-25` Adrian |
| lloyds | P | Incident | **Paul Grant** | Head of CoP Service Operations | +447700900123 | Europe/London | 24/7 | **yes** | Active | `today-20` Lukas |
| lloyds | P | Incident | Marta Kovacs | Payments Operations | +447700900124 | Europe/London | Mon-Fri 09:00-17:00 | no | Active | `today-200` Lukas |
| lloyds | P | Escalation | Sarah Whitfield | Head of Network Operations | +447700900125 | Europe/London | Mon-Fri 08:00-20:00 | | Active | `today-20` Lukas |
| mps (mps) | C | Champion | Giulia Ferri | Head of Transaction Banking | | | | | Active | `today-30` Emma |
| mps | C | Decision maker | Lorenzo Conti | Chief Operating Officer | | | | | Active | `today-30` Emma |
| mps | C | Technical | Paolo Greco | Integration Lead | +393351234510 | Europe/Rome | | | Active | `today-60` Adrian |
| mps | C | Incident | Silvia Moretti | Payments Operations Manager | +393351234511 | Europe/Rome | 24/7 | | Active | `today-60` Adrian |
| zopa (zopa) | C | Champion | Amelia Hughes | Head of Payments | | | | | Active | `today-58` Tom |
| zopa | C | Technical | Ben Carter | Platform Engineer | +447700900401 | Europe/London | | | Active | `today-15` Kevin Lim |
| zopa | C | Incident | Chloe Evans | Operations Lead | +447700900402 | Europe/London | 24/7 | | Active | `today-15` Kevin Lim |
| hvb (hvb) | C | Champion | Claudia Schulz | Head of Payments | | | | | Active | `today-90` Leo |
| hvb | C | Technical | Tobias Klein | IT Integration Lead | +491521234510 | Europe/Berlin | | | Active | `today-300` Adrian |
| hvb | C | Incident | Markus Wolf | Operations Manager | +491521234511 | Europe/Berlin | 24/7 | | Active | `today-300` Adrian |
| adyen (adyen) | C | Champion | Sanne de Vries | Head of Partnerships | | | | | Active | `today-60` Leo |
| adyen | C | Technical | Joris Bakker | CTO Office | +31622345610 | Europe/Amsterdam | | | Active | `today-200` Kevin Lim |
| adyen | C | Incident | Daan Visser | Operations Lead | +31622345611 | Europe/Amsterdam | 24/7 | | Active | `today-200` Kevin Lim |
| adyen | P | Incident | Lotte Jansen | Service Desk Lead | +31623456710 | Europe/Amsterdam | 24/7 | yes | Active | `today-15` Lukas |
| adyen | P | Escalation | Eva Smit | Head of Operations | +31624567810 | Europe/Amsterdam | Mon-Fri 09:00-18:00 | | Active | **never** |
| revolut (revolut) | C | Champion | Hannah Clarke | Head of Payment Partnerships | | | | | Active | `today-90` Michael |
| revolut | C | Technical | Oskar Lindqvist | Senior Integration Engineer | +447700900450 | Europe/London | | | Active | `today-30` Adrian |
| revolut | C | Incident | Priya Nair | Payments Incident Lead | +447700900456 | Europe/London | 24/7 | | Active | `today-30` Adrian |
| revolut | C | Billing | Ella Morgan | Finance Operations | | | | | Active | `today-60` Rachel |
| monzo (monzo) | C | Champion | Jack Robinson | Head of Payments | | | | | Active | `today-30` Michael |
| monzo | C | Technical | Leo Martin | Platform Engineer | +447700900501 | Europe/London | | | Active | `today-9` Kevin Lim |
| monzo | C | Incident | Isla Wright | Operations Lead | +447700900502 | Europe/London | 24/7 | | Active | `today-9` Kevin Lim |
| nordea (nordea) | C | Champion | Aino Virtanen | Head of Payments | | | | | Active | `today-150` Sophie |
| nordea | C | Technical | Mikko Laine | Integration Lead | +358401234510 | Europe/Helsinki | | | Active | `today-220` Adrian |
| nordea | C | Incident | Juha Nieminen | Operations Manager | +358401234511 | Europe/Helsinki | 24/7 | | Active | `today-220` Adrian |
| ingdiba (ing-diba) | C | Champion | Lena Fischer | Head of Payments | | | | | Active | `today-120` Ethan Brooks |
| ingdiba | C | Technical | Felix Wagner | Integration Engineer | +491711234510 | Europe/Berlin | | | Active | `today-180` Adrian |
| ingdiba | C | Incident | Max Hoffmann | Operations Lead | +491711234511 | Europe/Berlin | 24/7 | | Active | `today-180` Adrian |
| ingdiba | P | Incident | Jonas Weber | Network Operations | +491711234512 | Europe/Berlin | 24/7 | yes | Active | `today-10` Nora Lee |
| ocbc (ocbc) | P | Incident | Wei Ling Tan | Payments Operations | +6591234510 | Asia/Singapore | Mon-Fri 09:00-18:00 | yes | Active | `today-30` Lukas |
| ocbc | P | Escalation | Rajesh Kumar | Head of Operations | +6591234511 | Asia/Singapore | Mon-Fri 08:00-20:00 | | Active | `today-30` Lukas |
| boi (boi) | P | Incident | Ciaran Walsh | Service Operations | +353871234510 | Europe/Dublin | 24/7 | yes | Active | `today-40` Lukas |
| ceska (csas) | C | Champion | Petra Novotná | Head of Payments | | | | | Active | `today-10` Michael |
| ceska | C | Technical | Jan Dvořák | Integration Lead | +420601234510 | Europe/Prague | | | Active | `today-5` Kevin Lim |
| ceska | C | Incident | Tomáš Svoboda | Operations Manager | +420601234511 | Europe/Prague | 24/7 | | Active | `today-5` Kevin Lim |
| rbi (rbi) | C | Champion | Katrin Bauer | Head of Payments | | | | | Active | `today-400` Sophie |

Expected contact-driven items: Network (Lukas) has 3 rows: Eva Smit "Never verified" first, then Marta Kovacs (200 days), then João Ferreira (120 days). Finance has 1 billing contact row: Sofia Ribeiro (`today-204`). Tom has 1 "Champion left": Santander UK plc, "No active champion since `today-12`". scbPt has no Technical or Incident contact (it shows "No active incident contact" on its Overview; it reaches "Required fields empty" when Kevin Lim confirms the pickup).

#### 7.1.9 Handoffs

| # | Entity | Type | From → To | Sent | Status | Closed | Snapshot content |
|---|---|---|---|---|---|---|---|
| H1 | lloyds | SALES_TO_OPS | Tom → Adrian | `today-400` | Confirmed | `today-399` | Wizard summary of lloyds |
| H2 | mps | SALES_TO_OPS | Tom → Adrian | `today-380` | Confirmed | `today-378` | |
| H3 | mps | OPS_TO_CS | Adrian → Emma | `today-152` | Accepted | `today-150` | P9 Ramp-up, P10 UAT, P11 Testing & certification (stages on `today-152` per 7.1.6 and the even spread of 7.1.0); block on P11 none at send; commitment "Monthly service report until full DE volume"; contacts Technical and Incident confirmed |
| H4 | hvb | SALES_TO_OPS | Tom → Adrian | `today-500` | Confirmed | `today-499` | |
| H5 | hvb | OPS_TO_CS | Adrian → Leo | `today-302` | Accepted | `today-300` | "No open commitments" ticked |
| H6 | adyen | SALES_TO_OPS | Tom → Kevin Lim | `today-720` | Confirmed | `today-719` | |
| H7 | adyen | OPS_TO_CS | Kevin Lim → Leo | `today-202` | Accepted | `today-200` | |
| H8 | santanderUk | SALES_TO_OPS | Tom → Adrian | `today-262` | Confirmed | `today-261` | |
| H9 | santanderUk | OPS_TO_CS | Adrian → Sophie | `today-142` | Accepted | `today-140` | |
| H10 | totta | SALES_TO_OPS | Tom → Adrian | `today-257` | Confirmed | `today-255` | |
| H11 | totta | OPS_TO_CS | Adrian → Sophie | `today-6` | **Declined** | `today-4`, reason "Portuguese accounts sit with Ethan Brooks from October" | commitment "Confirm FR sandbox credentials, due `today+14`" |
| H12 | scbIt | SALES_TO_OPS | Tom → Adrian | `today-237` | Confirmed | `today-236` | |
| H13 | scbIt | OPS_TO_CS | Adrian → Emma | `today-47` | Accepted | `today-45` | |
| H14 | scbPt | SALES_TO_OPS | Michael → Kevin Lim | `ts(-3, "09:30")` | **Sent** | | P6, contacts Tiago Moreira, Notes for Onboarding as 7.1.4 |
| H15 | revolut | SALES_TO_OPS | Michael → Adrian | `today-200` | Confirmed | `today-199` | |
| H16 | zopa | SALES_TO_OPS | Tom → Kevin Lim | `today-60` | Confirmed | `today-58` | |
| H17 | monzo | SALES_TO_OPS | Michael → Kevin Lim | `today-30` | Confirmed | `today-29` | |
| H18 | ceska | SALES_TO_OPS | Michael → Kevin Lim | `today-10` | Confirmed | `today-9` | |
| H19 | nordea | SALES_TO_OPS + OPS_TO_CS | Michael → Adrian, Adrian → Sophie | `today-262`, `today-152` | Confirmed, Accepted | `today-261`, `today-150` | |
| H20 | ingdiba | SALES_TO_OPS + OPS_TO_CS | Michael → Adrian, Adrian → Ethan Brooks | `today-225`, `today-122` | Confirmed, Accepted | `today-224`, `today-120` | |
| H21 | rbi | SALES_TO_OPS + OPS_TO_CS | Michael → Adrian, Adrian → Sophie | `today-600`, `today-402` | Confirmed, Accepted | `today-599`, `today-400` | |

Seed invariants: no Ops → CS handoff with status Sent exists (Emma's "To pick up" and Adrian's "Awaiting acceptance" start empty). Revolut has no open Ops → CS handoff. Exactly one Sales → Ops handoff is Sent (H14).

#### 7.1.10 Owner assignments (M9) and owner history

| Entity | From → To | By | When | Reason | Acknowledged |
|---|---|---|---|---|---|
| hvb | Leo Martin → Emma Wilson | Leo Martin | `ts(-1, "17:10")` | "Rebalancing German accounts before Q4" | **no** (starts scenario 4, Home badge 1) |
| monzo | Kevin Lim → Ethan Brooks | Emma Wilson | `today-20` | "CS owns UK fintech accounts from kickoff" | yes, `today-19` |

Every other owner change comes from the handoffs in 7.1.9 (M9 AC12). The current owners and "Owner since" dates in 7.1.3 follow from both tables.

#### 7.1.11 KYB checks and periodic reviews (M12)

Evidence links are `https://docs.corvane-internal.example/<entity>/<check>.pdf`. The LEI check reads its GLEIF values at seed time (7.1.0). Sanctions lists screened: "EU, UK HMT, OFAC SDN" on every seeded sanctions check.

| Entity | Licence (number · authority · expiry) | Licence verified | LEI check verified | Ownership summary | Sanctions | Periodic review (status, last, next) | Expected Compliance item |
|---|---|---|---|---|---|---|---|
| adyen | DNB-BL-0412 · De Nederlandsche Bank · `today+23` | `today-700` Mei | `today-700` Mei | "No parent reported in GLEIF. UBO: two private shareholders above 25%." | No match, `today-700` | Planned, last `today-260`, next `today+105` | ≤30 days "Licence expires in 23 days" |
| scbPt | BdP-0193 · Banco de Portugal · no expiry | `today-3` Mei | `today-3` Mei | "Parent: Open Bank S.A. Ultimate parent: Banco Santander S.A." | No match, `today-3` | Planned, next `today+240` | Overdue "LEI lapsed in GLEIF" (GLEIF LAPSED) |
| mps | ABI-5030 · Banca d'Italia · no expiry | `today-380` | `today-380` | "No parent reported in GLEIF. Largest shareholder below 25%." | No match, `today-380` | Planned, last `today-370`, next `today-5` | Overdue "Periodic review overdue since `today-5`" |
| totta | BdP-0018 · Banco de Portugal · no expiry | `today-255` | `today-255` | "Parent: Banco Santander S.A., 99.9%." | No match, `today-255` | Planned, last `today-320`, next `today+45` | 31-60 days "Periodic review due in 45 days" |
| zopa | FRN-800542 · Bank of England, PRA · `today+80` | `today-58` | `today-58` | "Parent: Zopa Group plc, 100%." | No match, `today-58` | Planned, next `today+200` | 61-90 days "Licence expires in 80 days" |
| lloyds | FRN-119278 · Bank of England, PRA · no expiry | `today-399` | `today-399` | "Parent: Lloyds Banking Group plc, 100%." | No match, `today-399` | Planned, last `today-30`, next `today+150` | none |
| revolut | FRN-900562 · Bank of England, PRA · no expiry | `today-199` | `today-199` | "Parent: Revolut Group Holdings Ltd, 100%." | No match, `today-199` | Planned, next `today+120` | none |
| santanderUk | FRN-106054 · Bank of England, PRA · no expiry | `today-261` | `today-261` | "Parent: Santander UK Group Holdings plc. Ultimate parent: Banco Santander S.A." | No match, `today-261` | Planned, next `today+210` | none |
| scbIt | ABI-3191 · Banca d'Italia · no expiry | `today-236` | `today-236` | "Parent: Open Bank S.A. Ultimate parent: Banco Santander S.A." | No match, `today-236` | Planned, next `today+180` | none |
| hvb | BAFIN-KI-100208 · BaFin · no expiry | `today-499` | `today-499` | "Parent: UniCredit S.p.A. (LEI 549300TRUWO2CD2G5692), 99.9%. UBO: none above 25%." | No match, `today-499` | Planned, last `today-200`, next `today+160` | ≤30 days "LEI renewal in 20 days (22 Oct 2026)" from the real GLEIF renewal date 2026-10-22 (decision B3, see 7.2.5) |
| monzo | FRN-730427 · Bank of England, PRA · no expiry | `today-29` | `today-29` | "Parent: Monzo Bank Holding Group Limited, 100%." | No match, `today-29` | Planned, next `today+300` | none |
| lloyds, totta, adyen partner side | same four cards (one set per entity, M12 AC16) | | | | | | |
| fillers (nordea, ingdiba, ocbc, boi, ceska) | licence no expiry, all four Verified by Mei at the creation date + 1 | | | | | Planned, next `today+200` or later | none |
| rbi | all four Verified `today-599` | | | | | Planned, next `today+30` | none (Inactive excluded, M11 AC21) |

All verifiers are Mei Chen (Compliance) unless stated. Licence numbers are demo values; the Adyen number DNB-BL-0412 comes from the Resolution log. The audit log of adyen holds the four KYB creates from `today-700` (scenario 3 step 4), each field as its own entry.

#### 7.1.12 Contractual obligations (M13)

One card per role. "-" = not captured. Links: `https://docs.corvane-internal.example/<entity>/<role>-agreement.pdf`. "Last updated by" = Mei Chen at the date shown.

| Entity | Role | Incident notice (h) | Subprocessor notice (d) | Audit right | SLA % | EU VoP | UK CoP | Expiry | Link | Captured | Updated |
|---|---|---|---|---|---|---|---|---|---|---|---|
| revolut | Customer | **2** | 30 | Yes | 99.95 | Adhered | **Adhered** | `today+520` | yes | 8 of 8 | `today-190` |
| santanderUk | Customer | **4** | 60 | Yes | 99.95 | Not applicable | **Adhered** | `today+700` | yes | 8 of 8 | `today-250` |
| lloyds | Customer | **8** | 90 | Yes | 99.95 | Not applicable | **Adhered** | `today+400` | yes | 8 of 8 | `today-390` |
| zopa | Customer | **-** | 30 | No | 99.50 | Not applicable | **In progress** | `today+330` | yes | 7 of 8 | `today-55` |
| lloyds | Partner | **1** | 60 | Yes | 99.95 | Not applicable | Adhered | `today+545` | yes | 8 of 8 | `today-240` |
| monzo | Customer | 12 | **0** | Yes | 99.90 | Not applicable | **Not applicable** | `today+700` | yes | 8 of 8 | `today-28` |
| adyen | Customer | 4 | 30 | Yes | 99.90 | Adhered | Not applicable | `today+400` | yes | **8 of 8** | `today-700` |
| adyen | Partner | 4 | - | Yes | - | In progress | Not applicable | - | yes | **5 of 8** | `today-320` |
| mps | Customer | 6 | 60 | Yes | 99.95 | Adhered | Not applicable | `today+75` | yes | 8 of 8 | `today-375` |
| hvb | Customer | 24 | 30 | Yes | 99.90 | Adhered | Not applicable | `today-10` (badge "Expired") | yes | 8 of 8 | `today-495` |
| scbIt | Customer | 6 | 45 | Yes | 99.90 | Adhered | Not applicable | `today+500` | yes | 8 of 8 | `today-230` |
| totta | Customer | 4 | 60 | Yes | 99.95 | Adhered | Not applicable | `today+700` | yes | 8 of 8 | `today-250` |
| totta | Partner | 2 | 60 | Yes | 99.95 | Adhered | Not applicable | `today+600` | yes | 8 of 8 | `today-125` |
| nordea, ingdiba (both roles), ceska, ocbc, boi | as role | 8 | 30 | Yes | 99.90 | Adhered or Not applicable (by country) | Not applicable | `today+400` | yes | 8 of 8 | creation date |
| scbPt, rbi | Customer | no card ("No obligations captured yet") | | | | | | | | | |

Obligations view rule used by the oracles: the scheme filter matches a card whose scheme status is captured and differs from "Not applicable" (M13 AC10). Oracle for scenario 2 step 6 (Country GB, Scheme UK CoP, Role Customer, sort Incident notice ascending): Revolut Ltd 2, Santander UK plc 4, Lloyds Bank plc 8, Zopa Bank Limited "Not captured" last; count "4 agreements". Monzo drops out on "Not applicable" (scenario decision 5).

#### 7.1.13 Billing profiles (M14)

| Entity | Billing legal name | Street | City | Postal code | Country | VAT / tax ID | LEI | Corvane entity | Expected flag |
|---|---|---|---|---|---|---|---|---|---|
| zopa | **no profile** | | | | | | | | 9 fields missing (no contract either) |
| hvb | UniCredit Bank GmbH | Calea Victoriei 15 | București | **empty** | DE | **empty** | 2ZCNRR8UK83OBTEK2170 | Corvane Europe B.V. | 3: VAT / tax ID, Postal code, Contract reference |
| revolut | Revolut Ltd | 30 South Colonnade | London | E14 5HX | GB | GB987654321 | **213800MQORWPL582SW28** (transposed check digits, fails mod 97) | Corvane Singapore Pte. Ltd. | 1: LEI (invalid format) |
| totta | Banco Santander Totta, S.A. | Rua do Ouro 88 | Lisboa | 1100-063 | PT | PT500000017 | 549300URJH9VSI58CS32 | Corvane Europe B.V. | none |
| scbIt | Santander Consumer Bank S.p.A. | Corso Massimo d'Azeglio 33/E | Torino | 10126 | IT | IT01234567890 | 549300O0YQXDOJB36Y73 | Corvane Europe B.V. | none |
| lloyds | Lloyds Bank plc | 25 Gresham Street | London | EC2V 7HN | GB | GB123456789 | H7FNTJ4851HG0EXQ1Z70 | Corvane Singapore Pte. Ltd. | none |
| mps | Banca Monte dei Paschi di Siena S.p.A. | Piazza Salimbeni 3 | Siena | 53100 | IT | IT09876543210 | J4CP7MHCXR8DAQMKIL78 | Corvane Europe B.V. | none |
| adyen | Adyen N.V. | Bulevardul Dimitrie Pompeiu 9-9A | București | 020335 | NL | RO12345678 | 724500973ODKK3IFQ447 | Corvane Europe B.V. | none |
| monzo | Monzo Bank Ltd | Broadwalk House, 5 Appold Street | London | EC2A 2AG | GB | GB555666777 | 213800PLUYXGZ8LU7T61 | Corvane Singapore Pte. Ltd. | none |
| nordea, ingdiba, ceska, rbi | entity legal name | demo address | city | code | own country | `<ISO prefix>` + 9 digits | own LEI | Corvane Europe B.V. | none (rbi Inactive) |
| santanderUk, scbPt | no profile | | | | | | | | none: "Billed through Banco Santander Totta, S.A." (M14 AC15) |
| ocbc, boi | no profile | | | | | | | | none: "Billing profile not required: partner role only" |

VAT values are fictional and only pass the M14 AC2 format. Expected Finance list (sorted by count): Zopa Bank Limited 9, UniCredit Bank GmbH 3, Revolut Ltd 1. Santander Consumer Bank GmbH joins with 9 in scenario 1.

#### 7.1.14 Notes, action items and History

Notes (M10). Summaries are 20 to 5,000 characters; the text below is the seeded summary. Participants: internal users (U) and contacts (C).

| Entity | Type | Author | Interaction date | Participants | Summary | Action items (description, owner, due, status) |
|---|---|---|---|---|---|---|
| mps | Negotiation | Tom Hadley | `today-400` | U: Tom Hadley; C: Lorenzo Conti, Giulia Ferri | "Agreed EUR pricing with two volume tiers and a 60-day payment term. MPS asked for a monthly service report." | "Send final tier proposal", Tom Hadley, `today-395`, **Done** (`today-396`) |
| mps | Incident | Lukas Brenner | `today-45` | U: Lukas Brenner, Emma Wilson; C: Silvia Moretti | "Partner slowdown on Global validation DE for 40 minutes. MPS saw delayed responses. Service restored, root cause on the partner side." | none |
| mps | Call | Emma Wilson | `today-20` | U: Emma Wilson; C: Giulia Ferri | "Check-in on DE ramp-up. Volumes growing slowly. Giulia asked for a QBR before the renewal." | "Schedule QBR", Emma Wilson, `today-10`, Done (`today-12`) |
| mps | Payment | Rachel Wong | `today-12` | U: Rachel Wong | "Q3 invoice paid 18 days late, PO number missing" | "Confirm PO number for Q4 invoice", Rachel Wong, `today-3`, **Open** (shows "Overdue") |
| lloyds | Negotiation | Tom Hadley | `today-30` | U: Tom Hadley, Emma Wilson; C: James Holloway | "Lloyds asked to revisit the second volume tier after the CoP volume forecast went up." | "Send revised volume tiers", Tom Hadley, `today+14`, Open |
| lloyds | Incident | Lukas Brenner | `today-20` | U: Lukas Brenner | "Marta Kovacs moved to Payments Operations. Paul Grant is now the primary incident contact for CoP." | none |
| adyen | QBR | Leo Martin | `today-150` | U: Leo Martin; C: Sanne de Vries | "Reviewed Global validation volumes in NL. Adyen plans EU VoP as a partner later this year." | none |
| adyen | Call | Leo Martin | `today-60` | U: Leo Martin; C: Sanne de Vries | "Renewal discussion opened. Adyen wants the same pricing for another 12 months." | "Share renewal options", Leo Martin, `today+20`, Open |
| revolut | Call | Adrian Koh | `today-8` | U: Adrian Koh; C: Oskar Lindqvist | "Customer security team still owes the production certificates for EU VoP DE. Marked the line blocked." | "Chase certificates", Adrian Koh, `today+2`, Open |
| hvb | Call | Leo Martin | `today-35` | U: Leo Martin; C: Claudia Schulz | "Renewal date is close. HVB wants a proposal before the end of the month." | none |

Automatic History events are generated from every seeded fact (creation, handoffs, owner changes, product lines, stage changes, blocks, contacts, coverage, roles, group links, contract attachments, KYB and billing changes). Required named events, each at its seeded date and actor:

| Entity | Event (exact or pattern) | When | Actor |
|---|---|---|---|
| lloyds | "Incident contact changed: Primary is now Paul Grant (was Marta Kovacs)" | `today-20` | Lukas Brenner, Network |
| lloyds | "Coverage GB / UK CoP: Onboarding → Active (effective <date>). Reason: Certification passed." | `today-20` | Lukas Brenner |
| lloyds | "Role added: Network partner" | `today-245` | Adrian Koh |
| mps | "Record created by Tom Hadley (Sales)"; "Handoff sent to Adrian Koh by Tom Hadley"; "Handoff confirmed by Adrian Koh"; "Owner changed from Tom Hadley to Adrian Koh" | `today-380` to `today-378` | Tom, Adrian |
| mps | Stage changes on P9, P10, P11 | `today-300` to `today-25` | Adrian Koh |
| mps | "Global validation / DE marked blocked by Customer: ..." and "Global validation / DE block resolved after 15 days" | `today-70`, `today-55` | Adrian Koh |
| mps | "Handoff to Customer Success sent to Emma Wilson by Adrian Koh"; "Handoff accepted by Emma Wilson. Owner: Adrian Koh → Emma Wilson" | `today-152`, `today-150` | Adrian, Emma |
| totta | "Handoff declined by Sophie Mitchell: Portuguese accounts sit with Ethan Brooks from October" | `today-4` | Sophie Mitchell |
| hvb | "Owner reassigned" Leo Martin → Emma Wilson, reason as 7.1.10 | `today-1` | Leo Martin |
| santanderUk | Contact "Oliver Bennett (Champion) marked as left" | `today-12` | Tom Hadley |
| rbi | "Lifecycle state: BAU → Inactive" | `today-60` | Adrian Koh |
| lloydsLegacy | "Record status: Active → Deleted" with the reason | `today-14` | Adrian Koh |

Minimums (Part 1 3.1): every scenario entity (santanderUk, totta, scbIt, lloyds, mps, zopa, hvb, adyen, revolut, monzo) has at least 8 History items with the default filters on, and at least 15 audit entries. scbPt (created `today-3`) has at least 5 History items. mps has at least 12 History items across all 6 teams (scenario 4 step 5). A seed self-check (`npm run seed:check`, part of 7.3) asserts these counts.

#### 7.1.15 Scenario oracles: what each "View as" user sees on Home after a reset

Fixed reference day Friday 02 Oct 2026 in brackets.

| User | Section | Items (in order) |
|---|---|---|
| Tom Hadley | Awaiting pickup | none |
| | Overdue go-lives | Zopa Bank Limited · GB, UK CoP / GB, 6 days late (target `today-6` [26 Sep 2026]), Stage UAT |
| | Champion left | Santander UK plc · GB, "No active champion since `today-12`" [20 Sep 2026], Oliver Bennett |
| | Ownership assigned to you | none |
| Adrian Koh, Mine | To pick up | none ("Nothing to pick up. New customers from Sales appear here.") |
| | Awaiting acceptance | none |
| | Handoff declined | Banco Santander Totta, S.A. · PT, "Handoff declined by Sophie Mitchell: Portuguese accounts sit with Ethan Brooks from October" |
| | Blocked | Revolut Ltd · GB, EU VoP / DE blocked by Customer for 8 days |
| | Go-lives in the next 14 days | Revolut Ltd · GB, Global validation / SG in 9 days [11 Oct 2026], Testing & certification |
| | Too long in current stage | Revolut Ltd UK CoP / GB 60 days in Live & hypercare; Banco Santander Totta, S.A. EU VoP / FR 38 days in Sandbox & technical integration |
| | Required fields empty | Lloyds Bank plc · GB, "Missing: active Technical contact" |
| Adrian Koh, My team (adds) | To pick up | Banco Santander Consumer Portugal S.A. · PT, from Michael Reed to Kevin Lim, sent `today-3`, "Waiting 3 days" chip when 3 business days have passed (true on the reference Friday) |
| | Required fields empty | Zopa Bank Limited · GB, "Missing: No contract attached" |
| Emma Wilson, Mine | Ownership assigned to you | UniCredit Bank GmbH · DE, from Leo Martin, reason; Home badge 1 |
| | To pick up | none |
| | Renewals in the next 120 days | HVB "Renewal date passed" (`today-10`) Overdue; MPS "Renewal in 75 days" 61-90 days |
| Emma Wilson, My team (adds) | Renewals | Adyen N.V. · NL, owner Leo Martin, "Renewal in 100 days", 91-120 days |
| Lukas Brenner | Partner contacts not verified for 90+ days | Adyen / Eva Smit "Never verified"; Lloyds / Marta Kovacs 200 days; Totta / João Ferreira 120 days |
| Mei Chen | KYB and review expiries | Overdue: Banco Santander Consumer Portugal S.A. "LEI lapsed in GLEIF"; MPS "Periodic review overdue since `today-5`". ≤30: Adyen "Licence expires in 23 days"; UniCredit Bank GmbH "LEI renewal in 20 days (22 Oct 2026)" (real GLEIF renewal date, decision B3; kept as the live example of problem 7). 31-60: Totta review in 45 days. 61-90: Zopa licence in 80 days. Plus any other live GLEIF renewal inside 90 days (see 7.2.5) |
| Rachel Wong | Incomplete billing profiles (3) | Zopa 9, HVB 3, Revolut 1 |
| | Billing contacts not verified for 6+ months | Banco Santander Totta, S.A. / Sofia Ribeiro |

Search oracles: "Santander" returns 4 rows (5 after scenario 1). Country GB + Scheme UK CoP returns 4 rows: Revolut Ltd, Santander UK plc, Zopa Bank Limited (chip "Customer product") and Lloyds Bank plc (both chips, coverage status shown). "Financial Services" returns Adyen (legal name) and Zopa ("Matched alias: Zopa Financial Services"). "mps" returns MPS with "Matched alias: MPS". "monzo" returns 1 row before scenario 3 step 7 and 0 after. "IPE-MSA-2026-014" opens the Santander group.

Issues section oracles (from milestone 6C): 7.1.17.8. The "Issues" section sits above the sections listed here and leaves their rows unchanged.
#### 7.1.16 Conflicts resolved for the seed

1. Tom's "Champion left" item: Santander UK plc with Oliver Bennett Left on `today-12` (14_scenarii_demo Scenario 1 seed) replaces the HVB example in 13 S1 ("since 22 Sep 2026"). HVB keeps an active champion.
2. Santander UK plc UK CoP / GB stage: BAU (14 Scenario 2 seed) replaces "Live & hypercare" in the 13 S5 group table. Group stage tile adjusted to "Contract signed 1 · Sandbox & technical integration 1 · UAT 1 · Ramp-up 2 · BAU 1".
3. Santander Consumer Bank S.p.A. lifecycle Live (14) is incompatible with its only product at UAT (13 S5). Seed gives it EU VoP / IT at Ramp-up and adds Global validation / IT at UAT.
4. Lloyds Partner agreement incident notice: 1 h (14 Scenario 2 seed) replaces the 4 hours example in 13 S4.6.
5. Marta Kovacs verified `today-200` (14) and kept Active, so Lukas's list has 3 rows (13 S1 showed 2). Paul Grant stays first in the header because he is Primary.
6. João Ferreira's verifier changes from Nora Lee (13 S1) to Lukas Brenner: on `today-120` Nora Lee was still in Customer Success (team change `today-30`, scenario decision 6) and could not verify a Network-owned contact (M7 AC5).
7. Adrian's "Required fields empty" item on Lloyds Bank plc (13 S1) needs a product in Contract signed through Live & hypercare (M11 AC9), and Lloyds' only product per 14 is UK CoP / GB at BAU. Seed adds Global validation / GB at Sandbox & technical integration (P8). Search for GB + UK CoP is unaffected.
8. Zopa Bank Limited has no contract reference so Finance shows "9 fields" (13 S1). As a consequence Zopa also appears on the Ops "Required fields empty" list under Adrian's "My team" scope (owner Kevin Lim). Accepted.
9. Revolut Ltd's creator is Michael Reed, so Tom's "Overdue go-lives" holds only Zopa Bank Limited (14 Scenario 1 seed).
10. Monzo Bank Ltd is owned by a CS user while at Kickoff (14 Scenario 3 seed). The seed explains it with an acknowledged M9 reassignment by Emma Wilson on `today-20`.
11. The deleted "Lloyds Bank (legacy import)" record was deleted on `today-14` (14 and 13 S7.2 agree on 18 Sep 2026 = `today-14`).
12. Obligations scheme filter: an empty scheme status does not match a scheme filter; only captured values other than "Not applicable" match. This keeps scenario 2 at 4 agreements and matches decision 5.
13. No LEI-less legacy record is seeded (M12 edge case 1, 13 S4.6 state) because every seeded LEI is real. The state is covered by unit tests.
14. Fillers are real institutions with real LEIs (decision P3). They are absent from the corvane.example/news names listed in the institution research; the final QA re-check on 3 Oct 2026 (corvane.example/news, corvane.example/about and web searches) found none of the 6 announced as a Corvane customer or partner, and their LEIs, names and renewal dates match live GLEIF (7.2.4). Repeat the check before the demo (7.2.5).

#### 7.1.17 Issue flow seed (milestone 6A)

Loaded by `seed()` from milestone 6A (`prisma/seed/data/issues.ts`, `issue-team.ts`, `on-call.ts`), with every audit entry and `INCIDENT` History event, like the rest of 7.1. Appendix B examples use the reference day Monday 05 Oct 2026. Dates in the examples are illustrative: the build stores every seed time as an offset from the demo day, which must be Monday to Friday. The brackets below give both reference days: [Fri 02 Oct] for the existing tests (`DEMO_CLOCK_START=2026-10-02T09:00:00+03:00`, 08:00 CEST) and [Mon 05 Oct] for E2E-5 (`DEMO_CLOCK_START=2026-10-05T08:05:00Z`, 10:05 CEST).

**Helpers** (`prisma/seed/dates.ts`, on top of `d()` and `ts()` of 7.1.0):
- `tsz(n, "21:12", "Europe/Amsterdam")`: the instant at that local time in that zone on the date `today + n` (today in Europe/Bucharest), stored in UTC.
- `wd(n)`: the date `today + n`, moved back to the Friday before when it falls on a Saturday or Sunday. `wtsz(n, time, zone)` = `tsz` on `wd(n)`.
- The demo day must be Monday to Friday (7.2.5 item 12), so the hand-over of ISS-1042 happens on the demo day.

##### 7.1.17.1 User time zones (`User.timeZone`)

| User | Team | Stored time zone | Effective time zone (4.9.3) |
|---|---|---|---|
| Tom Hadley | Sales | Europe/Amsterdam | Europe/Amsterdam (CET/CEST) |
| Michael Reed | Sales | America/New_York | America/New_York (EST/EDT) |
| Adrian Koh | Ops | Asia/Kuala_Lumpur | Asia/Kuala_Lumpur (MYT) |
| Kevin Lim | Ops | Asia/Kuala_Lumpur | Asia/Kuala_Lumpur (MYT) |
| Emma Wilson | CS | Europe/Amsterdam | Europe/Amsterdam |
| Leo Martin | CS | Europe/Amsterdam | Europe/Amsterdam |
| Sophie Mitchell | CS | Europe/London | Europe/London (GMT/BST) |
| Ethan Brooks | CS | Europe/Amsterdam | Europe/Amsterdam |
| Lukas Brenner | Network | Asia/Singapore | Asia/Singapore (SGT) |
| Nora Lee | Network | Asia/Singapore | Asia/Singapore |
| Mei Chen | Compliance | Asia/Singapore | Asia/Singapore |
| Rachel Wong | Finance | Asia/Singapore | Asia/Singapore |

##### 7.1.17.2 Business hours per team (`TeamBusinessHours`)

| Team | Time zone | Hours | Weekdays |
|---|---|---|---|
| OPS | Asia/Kuala_Lumpur | 09:00 to 18:00 | 1 to 5 |
| NETWORK, COMPLIANCE, FINANCE | Asia/Singapore | 09:00 to 18:00 | 1 to 5 |
| SALES, CS | null (each user's own) | 09:00 to 18:00 | 1 to 5 |

##### 7.1.17.3 Issue team per entity (`IssueTeamMember`)

Customer owner = `Entity.ownerId` (7.1.3), never stored here. Sales = the Sales user who created the customer role (7.1.3 "Created (by)"); partner-only records created by Adrian Koh take the fallback Tom Hadley. Defaults (decision B18): Ops Adrian Koh, Network Lukas Brenner, Compliance Mei Chen, Finance Rachel Wong. `backupUserId` stays null (R2).

| Entity | Customer owner | Sales | Ops | Network | Finance | Compliance |
|---|---|---|---|---|---|---|
| revolut | Adrian Koh | Michael Reed | **Kevin Lim** | Lukas Brenner | Rachel Wong | Mei Chen |
| mps | Emma Wilson | Tom Hadley | Adrian Koh | Lukas Brenner | Rachel Wong | Mei Chen |
| hvb | Emma Wilson | Tom Hadley | Adrian Koh | Lukas Brenner | Rachel Wong | Mei Chen |
| santanderUk, totta, scbIt, lloyds, zopa, adyen | as 7.1.3 | Tom Hadley | Adrian Koh | Lukas Brenner | Rachel Wong | Mei Chen |
| scbPt, monzo, nordea, ingdiba, ceska, rbi, lloydsLegacy | as 7.1.3 | Michael Reed | Adrian Koh | Lukas Brenner | Rachel Wong | Mei Chen |
| ocbc, boi (partner only) | as 7.1.3 (ocbc: No owner) | Tom Hadley (fallback) | Adrian Koh | Lukas Brenner | Rachel Wong | Mei Chen |

The customer-create service (milestone 6) writes the same defaults for a new record from milestone 6A on, with the creating Sales user as Sales person: Santander Consumer Bank GmbH, created in scenario 1, gets Tom Hadley and the four defaults.

##### 7.1.17.4 On-call rota (`OnCallShift`)

| Team | User | Starts | Ends (exclusive) |
|---|---|---|---|
| OPS | Kevin Lim | `tsz(-7, "00:00", "Asia/Kuala_Lumpur")` | `tsz(14, "00:00", "Asia/Kuala_Lumpur")` |
| NETWORK | Nora Lee | `tsz(-7, "00:00", "Asia/Singapore")` | `tsz(14, "00:00", "Asia/Singapore")` |
| COMPLIANCE | Mei Chen | `tsz(-7, "00:00", "Asia/Singapore")` | `tsz(14, "00:00", "Asia/Singapore")` |

No shift for Sales and Finance (decision B19). One shift per team covers the previous evening, the demo day and two weeks after it.

##### 7.1.17.5 Seed issues

| Field | ISS-1042 | ISS-1038 | ISS-1031 |
|---|---|---|---|
| Entity, product line | mps, P9 EU VoP / IT (BAU) | revolut, P15 UK CoP / GB (Live & hypercare) | hvb, none |
| Scheme, country | EU_VOP, IT | UK_COP, GB | none, none |
| Type | Service unavailable or latency | Wrong match result | Billing |
| Impact, possible breach | Down, No | Degraded, No | Isolated case, No |
| Proposed and stored severity, cap | Sev-1, none | Sev-2, none | Sev-3, none (`stageAtReport` BAU from P13) |
| Description | "Monitoring alert: every EU VoP request for Banca Monte dei Paschi di Siena S.p.A. (IT) times out since 21:10 CEST. Error rate 100 % over 2 minutes." | "Payee 'J Smith Plumbing Ltd' returns No match for the trading name 'Smith Plumbing'. 14 cases since 08:00." | "Claudia Schulz reports that the Q3 invoice shows no PO number and the wrong VAT ID. HVB asks for a corrected invoice before payment." |
| Reporter | Monitoring (automatic) (`reporterKind = MONITORING`) | Adrian Koh (Ops) | Rachel Wong (Finance) |
| Reported at the customer by | Found by Corvane | Priya Nair (contact, Incident) | Claudia Schulz (contact, Champion) |
| Corvane aware at | `tsz(-1, "21:12", "Europe/Amsterdam")` [Fri 02 Oct: Thu 01 Oct 21:12 CEST; Mon 05 Oct: Sun 04 Oct 21:12 CEST = 03:12 MYT] | `wtsz(-3, "15:10", "Asia/Kuala_Lumpur")` [Tue 29 Sep; Fri 02 Oct] | `wtsz(-2, "10:40", "Asia/Singapore")` [Wed 30 Sep; Fri 02 Oct] |
| Saved (`createdAt`, `clocksStartAt`, `ackStartAt`) | same instant as Corvane aware at | `wtsz(-3, "15:20", "Asia/Kuala_Lumpur")` | `wtsz(-2, "11:00", "Asia/Singapore")` |
| Owner team, owner, rule | Ops, Kevin Lim, `ON_CALL_OUT_OF_HOURS` | Ops, Kevin Lim, `NAMED_PERSON` | Finance, Rachel Wong, `NAMED_PERSON` |
| "Why this owner" | "Outside Ops business hours: routed to the Ops on-call person" | "Revolut Ltd's named Ops person, inside Ops business hours" | "UniCredit Bank GmbH's named Finance person, inside Finance business hours" |
| Communicator rule | `ISSUE_OWNER_UNTIL_HANDOVER`, `handoverAt` = Emma Wilson's next business start after Corvane aware at = `tsz(0, "09:00", "Europe/Amsterdam")` on a Monday to Friday demo day; `handoverWrittenAt` null | `CUSTOMER_OWNER` (Adrian Koh) | `CUSTOMER_OWNER` (Emma Wilson) |
| Contributors | none (no default for the type) | Lukas Brenner, default | Tom Hadley, default (HVB's Sales person) |
| Acknowledge | due +15 min (21:27 CEST); acknowledged 21:21 CEST by Kevin Lim | due +60 min (16:20 MYT); acknowledged 15:35 MYT by Kevin Lim | due +540 business minutes of Finance (next business day 11:00 SGT); acknowledged 11:30 SGT by Rachel Wong |
| Status | In progress | In progress | In progress |
| Notification clock | required; start = Corvane aware at; `notifyTargetHours` 6 (MPS card); due `tsz(0, "03:12", "Europe/Amsterdam")`; `notifiedAt` 22:05 CEST the evening before | required; start = Corvane aware at; 240 business minutes of Adrian Koh (Kuala Lumpur), due next business day 10:10 MYT; `notifiedAt` 16:10 MYT | not required ("Customer notification: no deadline at Sev-3") |
| Communication log | First notification, Email, Silvia Moretti, 22:05 CEST, recorded by Kevin Lim: the M22 AC3 template body prepared at 22:00 CEST, times in Europe/Rome | First notification, Email, Priya Nair, 16:10 MYT, recorded by Adrian Koh: the M22 AC3 template body prepared at 16:05 MYT, times in Europe/London | none |
| Compliance | Flagged at Corvane aware at, reason "Sev-1 at a regulated customer (EU DORA)", clock start same, assessor Mei Chen (Compliance on-call, outside Compliance hours), due 22:12 CEST; assessment "Possible major incident" at 21:58 CEST by Mei Chen, rationale "EU VoP is down for a DORA bank: MPS may classify this as a major ICT incident."; `factsTargetHours` 2, `factsDueAt` 23:58 CEST (rendered from R2) | not flagged (Sev-2, no breach) | not flagged (Sev-3, no breach) |
| Notes | Kevin Lim, 21:40 CEST: "Endpoint certificate for EU VoP IT expired after the rotation job failed. Renewing it now." | Lukas Brenner, `wtsz(-3, "16:30", "Asia/Singapore")`: "The responding bank matches on legal names only. Raised with its service desk; they are checking trading name support." | Tom Hadley, `wtsz(-2, "09:30", "Europe/Amsterdam")`: "Andreea has the Q4 PO number. I asked her to send it with her confirmation." |
| Expected clock rows | "Acknowledged 9 min after report (target 15 min)"; "Notified 53 min after Corvane aware at (target 6h)"; "Assessed 46 min after the flag (target 1h)" | "Acknowledged 15 min after report (target 1h)"; "Notified 1h after Corvane aware at (target 4 business hours)" | "Acknowledged 30 min after report (target 1 business day)"; "Customer notification: no deadline at Sev-3" |

The seed does not write the hand-over of ISS-1042. The first read after `handoverAt` writes it (4.9.7): log and note "Communication handed over to Emma Wilson at 09:00 CEST. Already communicated: First notification by Email to Silvia Moretti at 22:05 CEST by Kevin Lim. Owner: Kevin Lim." Each seeded fact writes its audit entries and `INCIDENT` History event at its seeded time and actor ("Monitoring (automatic)" with source `SYSTEM_ISSUE` for the ISS-1042 creation). After the three issues the seed runs `SELECT setval('issue_number_seq', 1042)`, so the next report is ISS-1043.

##### 7.1.17.6 Regulatory block on the Customer agreement cards (M26 AC10)

Written with the card's seeded create (same date and actor as 7.1.12, so "Last updated by" stays as it is). "Post-incident report due (days)" is seeded and rendered in R1 (M26 AC9 moved to R1 on 08 Oct 2026).

| Entity | Regime | Regulator's deadline | Facts needed within (h) | Report due (days, R2) |
|---|---|---|---|---|
| mps | EU DORA | "DORA: initial notification within 4 hours of classification, at the latest 24 hours after detection" | 2 | 20 |
| santanderUk | UK FCA | "FCA: notify as soon as aware of a material operational incident" | 4 | 30 |
| lloyds (Customer card) | UK FCA | same as santanderUk | 4 | 14 |
| revolut | UK FCA | same as santanderUk | 4 | 14 |
| hvb | EU DORA | same as mps | 2 | 20 |
| adyen (Customer card) | EU DORA | same as mps | 2 | 20 |
| monzo, zopa | not captured | | not captured | |
| scbIt, totta, nordea, ingdiba, ceska | None | | | |
| scbPt, rbi | no card | | | |

Partner agreement cards carry no regulatory values (M26 AC1). Expected: MPS block "4 of 4 captured"; Zopa and Monzo "Regulatory: not captured"; the M13 counters of 7.1.12 are unchanged.

##### 7.1.17.7 Invariants

1. Exactly three issues: ISS-1031, ISS-1038, ISS-1042, all In progress and acknowledged; none New, none Closed, none overdue on its acknowledge or notification clock, none queued.
2. Next issue number: 1043.
3. No partner issue, no `IssueLink`, no `IssueGroupReport`, no root cause report task.
4. One issue in an interim communicator period (ISS-1042 until 09:00 CEST on the demo day).
5. Every seeded entity has the five `IssueTeamMember` rows of 7.1.17.3; one `OnCallShift` per on-call team covers every instant from `today-7` to `today+14`.
6. Only ISS-1042 is flagged for Compliance, and it is assessed.
7. The M11 oracles of 7.1.15 are unchanged.

##### 7.1.17.8 Scenario oracles: the "Issues" section per user after a reset

[Mon 05 Oct, 10:05 CEST] (after Emma Wilson's 09:00 CEST start; E2E-5):

| User | Main list (in order) | Contributing | Reported by me | Title | Badge |
|---|---|---|---|---|---|
| Tom Hadley | none | ISS-1031 · Sev-3 · UniCredit Bank GmbH · In progress · "Owner: Rachel Wong (Finance)" | none | "Issues (1)" | hidden |
| Adrian Koh | ISS-1038 · Sev-2 · Wrong match result · Revolut Ltd · GB · UK CoP GB · In progress · "Communicator" · no step | none | none (he holds another role) | "Issues (1)" | hidden |
| Emma Wilson | ISS-1042 · Sev-1 · Service unavailable or latency · Banca Monte dei Paschi di Siena S.p.A. · IT · EU VoP IT · In progress · "Communicator" · no step; ISS-1031 · Sev-3 · Billing · UniCredit Bank GmbH · DE · In progress · "Communicator" · no step | none | none | "Issues (2)" | 1 (M9 assignment) |
| Lukas Brenner | none | ISS-1038 · Sev-2 · Revolut Ltd · In progress · "Owner: Kevin Lim (Ops)" | none | "Issues (1)" | hidden |
| Mei Chen | empty: "No issues for you. Report one from the entity record." (assessment recorded) | none | none | "Issues (0)" | hidden |
| Rachel Wong | ISS-1031 · Sev-3 · Billing · UniCredit Bank GmbH · In progress · "Owner" · "Resolve" | none | none | "Issues (1)" | 1 |
| Kevin Lim (API and unit test; not in "View as") | ISS-1042 · "Owner" · "Resolve"; ISS-1038 · "Owner" · "Resolve" | none | none | "Issues (2)" | 2 |

[Fri 02 Oct, 08:00 CEST] (before Emma Wilson's start; `seed.test.ts`): as above, except Emma Wilson's main list holds only ISS-1031 (title "Issues (1)"), and Kevin Lim's ISS-1042 row reads "Owner and communicator". ISS-1042 shows "Communicator: Kevin Lim (on-call) until 09:00 CEST, then Emma Wilson" to Emma and "until 15:00 MYT" to Kevin.

Rows with no step sort after rows with a deadline by severity, then Corvane aware at (M20 AC3). Entity Issues tabs: MPS lists ISS-1042, Revolut Ltd ISS-1038, UniCredit Bank GmbH ISS-1031; every other entity shows "No issues reported on this entity". When the Revolut Ltd handoff is accepted (`chain.spec.ts`, and the service test of milestone 7), ISS-1038 leaves Adrian's main list and appears in Emma's with the log entry "Communicator changed to Emma Wilson: customer owner changed" (M18 AC7).

---

### 7.2 Demo mode

#### 7.2.1 Environment variables

| Variable | Values | Default | Use |
|---|---|---|---|
| `DEMO_MODE` | `true`, `false` | `false` | Turns on the demo strip, "View as", auto sign-in and "Reset demo data". When `false`, `/api/demo/*` returns 404 (M16 AC16) |
| `DATABASE_URL` | Postgres URL | | App role `hub_app`: `SELECT, INSERT` only on `AuditEntry` (M16 AC3), rights elsewhere as 3.1.4 |
| `DATABASE_ADMIN_URL` | Postgres URL | | Owner role `hub_owner`, used only by migrations, `db:reset`, seed and the reset endpoint (the only path that removes audit entries) |
| `GLEIF_FORCE_CACHE` | `true`, `false` | `false` | Runtime lookups (wizard, Refresh from GLEIF): `false` = live with cache fallback (3.5.2), `true` = cache only |
| `GLEIF_SEED_SOURCE` | `live-with-fallback`, `cache` | `live-with-fallback` | GLEIF values written into LEI KYB checks by the seed |
| `GLEIF_TIMEOUT_MS` | integer | `5000` | M2 states (timeout after 5 seconds) |
| `GLEIF_CACHE_PATH` | path | `data/gleif-cache.json` | Cache file (7.2.4) |
| `APPROVED_DOC_HOSTS` | comma list | `docs.corvane-internal.example` | M12 AC7, M13 AC2, M4 AC9 |
| `DEMO_CLOCK_START` | ISO instant | unset | Tests only. Starts the clock in `src/lib/dates.ts` at this instant and lets it run. Ignored when `NODE_ENV=production` |

`docker-compose.yml` creates both roles (`docker/initdb/01-roles.sql`). `prisma/grants.sql` gives `hub_app` only `SELECT, INSERT` on `AuditEntry`, and migration `0002_constraints` adds the append-only trigger (3.2.3).

#### 7.2.2 "View as" and sign-in

- Cookie `ch_user` (httpOnly, SameSite=Lax) holds the signed user id. With `DEMO_MODE=true` and no cookie, middleware signs the session in as the user in `DEMO_DEFAULT_USER_EMAIL`, Adrian Koh (the Intro starts as Ops).
- `POST /api/demo/view-as` with `{ "team": "SALES" | "OPS" | "CS" | "NETWORK" | "COMPLIANCE" | "FINANCE" }` maps to the primary user (M15 AC11) and rewrites the cookie. 404 when `DEMO_MODE` is off.
- The client then reloads the current URL. If the new user cannot open it (Admin pages, Audit tab, wizard), the server redirects to `/` with the toast "You don't have access to that page as <team>" (resolution 59). Search query strings survive the switch (scenario 2 step 6).
- Toast after switch: "Now viewing as Emma Wilson (Customer Success)". Home opens on scope "Mine" (resolution 8).
- Every write is authorised and audited as the impersonated user and team (M16 edge case 2).

#### 7.2.3 Reset demo data (admin, DEMO_MODE only)

- Admin menu item "Reset demo data", visible only to the admin and only when `DEMO_MODE=true`. Dialog "Reset all demo data? Every change made since the last reset is lost." with buttons "Reset demo data" (carmine) and "Cancel".
- `POST /api/demo/reset`: 404 when `DEMO_MODE` is off, 403 for non-admins. Runs on `DATABASE_ADMIN_URL` in one transaction: truncate every data table (users included; `DemoMeta` excluded so its counter survives), run the seed with today from `src/lib/dates.ts`, increment `DemoMeta.seedVersion` (3.2.2).
- Response redirects to `/` with the toast "Demo data reset". Middleware compares a `ch_seed` cookie with `DemoMeta.seedVersion`; on mismatch every other open session is sent to Home on its next request and the cookie is refreshed (M16 AC16 "returns every user to Home").
- Target duration under 10 seconds with `GLEIF_SEED_SOURCE=live-with-fallback` (GLEIF calls run in parallel, 5-second timeout, cache fallback per LEI).

#### 7.2.4 GLEIF client and cache file

- `src/server/gleif/client.ts` exposes `lookupLei(lei)` with the `GleifLookup` contract of 3.5.2 (`found`, `not_found`, `unavailable`). Live calls: `GET https://api.gleif.org/api/v1/lei-records/{lei}`, `.../{lei}/direct-parent`, `.../{lei}/ultimate-parent` (404 on a parent means none), header `Accept: application/vnd.api+json`, all three in parallel under one `GLEIF_TIMEOUT_MS` budget.
- Fallback (3.5.2): a timeout, network error, 429 or 5xx answers from the cache when the LEI is in it, with the fetch time taken from `capturedAt`. An LEI outside the cache returns `unavailable` (Shared conventions, "GLEIF in the demo").
- `npm run gleif:snapshot` rewrites the cache from live GLEIF for the LEI list below. `npm run gleif:check` compares live GLEIF with the cache and prints the pre-demo warnings in 7.2.5.
- E2E tests use a frozen copy at `tests/e2e/fixtures/gleif-cache.json` (the 03 Oct 2026 snapshot) that `gleif:snapshot` never touches.

**File format (`data/gleif-cache.json`):**

```json
{
  "capturedAt": "2026-10-03T00:00:00Z",
  "source": "https://api.gleif.org/api/v1",
  "records": {
    "5299000I7Y60A8273788": {
      "lei": "5299000I7Y60A8273788",
      "legalName": "Santander Consumer Bank GmbH",
      "legalAddressCountry": "AT",
      "headquartersCountry": "AT",
      "registrationStatus": "ISSUED",
      "nextRenewalDate": "2027-08-27",
      "entityStatus": "ACTIVE",
      "successorLei": null,
      "directParent": { "lei": "5493006QMFDDMYWIAM13", "legalName": "BANCO SANTANDER S.A.", "country": "ES" },
      "ultimateParent": { "lei": "5493006QMFDDMYWIAM13", "legalName": "BANCO SANTANDER S.A.", "country": "ES" }
    }
  }
}
```

**LEIs in the cache, with the values read from live GLEIF on 03 Oct 2026:**

| LEI | GLEIF legal name | Country | Registration status | Next renewal | Direct parent | Ultimate parent |
|---|---|---|---|---|---|---|
| 5493006QMFDDMYWIAM13 | BANCO SANTANDER S.A. | ES | ISSUED | 2027-06-09 | none | none |
| PTCQB104N23FMNK2RZ28 | SANTANDER UK PLC | GB | ISSUED | 2027-04-08 | 549300F5XIFGNNW4CF72 Santander UK Group Holdings plc | 5493006QMFDDMYWIAM13 |
| 549300URJH9VSI58CS32 | BANCO SANTANDER TOTTA, S.A. | PT | ISSUED | 2027-06-23 | 5493006QMFDDMYWIAM13 | 5493006QMFDDMYWIAM13 |
| 549300O0YQXDOJB36Y73 | SANTANDER CONSUMER BANK S.P.A. | IT | ISSUED | 2027-09-08 | 5493000LM0MZ4JPMGM90 Open Bank S.A. | 5493006QMFDDMYWIAM13 |
| 5299000I7Y60A8273788 | Santander Consumer Bank GmbH | AT | ISSUED | 2027-08-27 | 5493006QMFDDMYWIAM13 | 5493006QMFDDMYWIAM13 |
| 549300Z5VU00GHU3B005 | BANCO SANTANDER CONSUMER PORTUGAL S.A. | PT | **LAPSED** | 2021-11-12 | 5493000LM0MZ4JPMGM90 | 5493006QMFDDMYWIAM13 |
| H7FNTJ4851HG0EXQ1Z70 | LLOYDS BANK PLC | GB | ISSUED | 2027-04-29 | 549300PPXHEU2JF0AM85 Lloyds Banking Group plc | same |
| J4CP7MHCXR8DAQMKIL78 | BANCA MONTE DEI PASCHI DI SIENA S.P.A. | IT | ISSUED | 2027-09-29 | none | none |
| 213800QW7QJVVCL9RZ56 | ZOPA BANK LIMITED | GB | ISSUED | 2027-04-28 | 213800CH9Q31TMDRXN75 Zopa Group plc | same |
| 2ZCNRR8UK83OBTEK2170 | UNICREDIT BANK GMBH | RO | ISSUED | **2026-10-22** | 549300TRUWO2CD2G5692 UniCredit S.p.A. | same |
| 724500973ODKK3IFQ447 | ADYEN N.V. | RO | ISSUED | 2027-07-18 | none | none |
| 213800MQORWPL582SW82 | REVOLUT LTD | GB | ISSUED | 2027-04-25 | 213800UIKMYZWWQS5E02 Revolut Group Holdings Ltd | same |
| 213800PLUYXGZ8LU7T61 | MONZO BANK LTD | GB | ISSUED | 2027-02-27 | 213800WIZ7R66OO87N21 Monzo Bank Holding Group Limited | same |
| 549300TRUWO2CD2G5692 | ERSTE GROUP BANK AG | AT | ISSUED | 2027-10-03 | none | none |
| 5493000LM0MZ4JPMGM90 | OPEN BANK SOCIEDAD ANONIMA | ES | (as fetched) | (as fetched) | (as fetched) | (as fetched) |
| 529900ODI3047E2LIV03 | Nordea Bank Abp | FI | ISSUED | 2027-11-02 | (as fetched) | (as fetched) |
| 3KXUNHVVQFIJN6RHLO76 | ING-DIBA AG | DE | ISSUED | 2027-02-24 | (as fetched) | (as fetched) |
| 5493007O3QFXCPOGWK22 | OVERSEA-CHINESE BANKING CORPORATION LIMITED | SG | ISSUED | 2027-02-10 | (as fetched) | (as fetched) |
| Q2GQA2KF6XJ24W42G291 | The Governor and Company of the Bank of Ireland | IE | ISSUED | 2027-08-23 | (as fetched) | (as fetched) |
| 9KOGW2C2FCIOJQ7FF485 | Česká spořitelna, a.s. | CZ | ISSUED | 2027-03-09 | (as fetched) | (as fetched) |
| 9ZHRYM6F437SQJ6OUG95 | Raiffeisen Bank International AG | AT | ISSUED | 2027-03-17 | (as fetched) | (as fetched) |

Fields per record: `lei`, `legalName`, `legalAddressCountry`, `headquartersCountry`, `registrationStatus`, `nextRenewalDate` (date only), `entityStatus`, `successorLei` (or null), `directParent` and `ultimateParent` (each `{lei, legalName, country}` or null). "(as fetched)" rows are filled by `gleif:snapshot`.

#### 7.2.5 Pre-demo checklist

Run the day before and again 1 hour before the session.

1. `npm run gleif:check` and read its warnings:
   - 549300Z5VU00GHU3B005 (Banco Santander Consumer Portugal S.A.) is still **LAPSED**. If it changed to ISSUED, the Overdue item disappears: point at the MPS overdue review and show the lapsed case from a screenshot (scenario 3 risk table).
   - 724500973ODKK3IFQ447 (Adyen) next renewal is more than 90 days after the demo day. If not, its LEI card shows Expiring: say it out loud as a second real expiry.
   - 2ZCNRR8UK83OBTEK2170 (HVB) renewal was 2026-10-22 on 03 Oct 2026. If it is still inside 90 days on the demo day, Mei's list shows "LEI renewal in <n> days" for HVB: present it as a real GLEIF date. If GLEIF has renewed it, it drops off.
   - Any other seeded LEI whose renewal falls inside 90 days, or whose status is no longer ISSUED, is printed with the worklist bucket it will land in.
   - 5299000I7Y60A8273788 still returns "Santander Consumer Bank GmbH", AT, ultimate parent 5493006QMFDDMYWIAM13.
2. Run `npm run gleif:snapshot` if GLEIF is reachable, so the fallback holds today's values.
3. Repeat the Corvane exclusion check (corvane.example/news plus one web search) for the 6 filler institutions and the 12 scenario institutions.
4. As Adrian Koh (Ops): Admin > "Reset demo data". Confirm the toast "Demo data reset".
5. Walk the Home oracle in 7.1.15 for the 6 users. In particular: Adrian "To pick up" (Mine) empty; Emma badge 1; Lukas list starts with "Never verified"; Lloyds UK CoP / GB is Active.
6. Search GB + UK CoP: count "4 institutions". Obligations view: "4 agreements".
7. Search "Santander": 4 rows. Search "monzo": 1 row.
8. Open a contract link to confirm what the host does in the room's network (scenario 2 risk); if unreachable, plan to skip the click.
9. Paste-ready snippets in a text file: the SCB GmbH LEI, the duplicate reason, step 2 values (EUR, 0.0400, tiers, 30 days, 99.95), Katharina Huber's details, the two Adyen evidence URLs (`https://drive.example.com/adyen-licence.pdf` rejected, `https://docs.corvane-internal.example/adyen/licence-2026.pdf` approved), the Monzo delete reason, the reassign reason and the QBR note text.
10. History filters: on the Lloyds and MPS History tabs click "Reset filters" (filters persist in the browser session, M10 AC8).
11. Browser zoom 100 %, window at least 1280 px wide, `DEMO_MODE=true`.
12. Issue flow (from milestone 6A): the demo day is Monday to Friday. After 09:00 CEST (10:00 in Bucharest) open ISS-1042 as Emma Wilson: she is the communicator and the log starts with the hand-over entry. Before that time it still shows Kevin Lim (on-call) as communicator. Walk the Issues oracles of 7.1.17.8 for the 6 users.

---

### 7.3 Test plan

#### 7.3.1 Unit tests (Vitest)

Every rule lives in a pure function in `lib/rules/*` or `lib/validators/*` so it can be tested without the database. Tests that need the database use a fresh schema per file.

The Release column says which cases R1 must pass (gate) and which arrive with R2. A case marked R2 is written in the R2 milestone that delivers its rule. Full split: 7.6.8.

| File | Cases (each bullet is at least one test) | Release |
|---|---|---|
| `validators/lei.test.ts` | 20 chars uppercase A-Z0-9; trim and uppercase input; mod 97-10 passes for all 21 cache LEIs; `213800MQORWPL582SW28` fails; 19 chars fails; lowercase input normalised; error copy "LEI must be 20 letters or digits and pass the ISO 17442 check" (M2 AC3); billing copy "LEI must be 20 characters and pass the check digit test" (M14 AC4) | R1 |
| `validators/bic.test.ts` | 8 and 11 chars; country letters must be a valid ISO 3166-1 code; uppercase; BIC8 prefix match; country mismatch returns a warning (M2 AC4) | R1 |
| `validators/contact.test.ts` | E.164 strip of spaces, hyphens, dots, brackets; `0044 7700 900123` fails with suggestion `+447700900123`; email rules and lowercase; phone required for Incident and Escalation; time zone required for Incident, Escalation, Technical; availability 24/7 or weekdays + times; 22:00-06:00 crosses midnight (M7 AC4, edge cases 2, 3) | R1 (time zone and availability capture is R1, decision B12) |
| `rules/availability.test.ts` | "Available now" for 24/7; Singapore Mon-Fri 09:00-18:00 at 15:00 Bucharest shows "Local time 20:00, Outside availability" (M7 edge case 1); midnight-crossing window | R1 |
| `validators/commercial.test.ts` | price > 0, max 4 decimals; tiers ascend, no overlap, no gap ("Tiers must be continuous"), last "to" may be empty; payment term 1-180; SLA 90.00-100.00; text lengths (M3 AC5-AC7) | R1 |
| `validators/productLine.test.ts` | UK CoP only GB; EU VoP only SEPA list; Global validation any; unique product + country + contracting entity; past target "Target go-live is in the past"; target before contract signing blocked (M3 AC2, AC3, M6 edge case 6) | R1: scheme and country rules, uniqueness, past target. R2: target before contract signing (M6 edge case 6) |
| `validators/billing.test.ts` | VAT strip and uppercase; EU prefix incl. Greece `EL`; `NL123456789B01` with country DE gives "VAT ID must start with DE for Germany"; non-EU 4-20 alnum (M14 AC2, edge case 3) | R1 (the flag re-checks VAT format) |
| `validators/links.test.ts` | https only; approved host list; `https://drive.example.com/...` gives "Use a link to approved document storage"; 2,048 char max (M12 AC7, M13 AC2) | R1 |
| `validators/obligations.test.ts` | "4.5" hours rejected with exact copy; 1-720; 0-365 days, 0 displays "No advance notice required"; SLA 2 decimals; counter "n of 8 captured" (M13 AC2-AC4) | R1 |
| `rules/permissions.test.ts` | Table-driven over the full M15 AC3 matrix: for each data area × team, `can(team, area, action)` equals the matrix cell; admin flag adds only Admin pages, Audit tab, soft delete and reset; contact owner team from context + role (Billing → Finance in both contexts); denied write returns `{"error":"forbidden","owner_team":"<Team>"}`; Roles & permissions page renders from the same matrix object | R1 |
| `rules/worklists.test.ts` | One describe per rule M11 AC5-AC18, AC24 with boundary cases: licence at exactly 30 days is ≤30; go-live exactly 14 days ahead included; contact verified exactly 90 days ago excluded, 91 included; "Waiting" after 2 business days (Friday/Monday cases); thresholds 21 and 56 days, Ramp-up and BAU excluded; LEI LAPSED with renewal in 20 days appears once as Overdue (M11 edge case 2); scopes Mine, My team, Sales creator, resolution 10 (sender keeps Ops items after acceptance); deleted and Inactive excluded; "No owner" items only under My team; sort orders (resolution 15, Network never-verified first, Finance by count) | R1: AC5 (To pick up, Awaiting acceptance), AC6 to AC13; licence at 30 days, go-live at 14 days, thresholds 21 and 56, Ramp-up and BAU excluded; LEI lapsed plus renewal once; "Mine" scope; deleted and Inactive excluded; Overdue-first sort. R2: AC14 to AC18, AC24; contact 90/91-day boundary; "Waiting" after 2 business days; "My team", Sales scope, resolution 10, "No owner"; Network and Finance sorts; Handoff declined |
| `rules/billingFlag.test.ts` | 9 required fields; invalid seeded LEI flags; partner-only gives no flag and the "not required" note; Inactive or deleted gives no flag; billed through another entity gives no flag (resolution 55); removed Corvane entity option flags (M14 edge case 5); different billing LEI warns without flagging (edge case 2) | R1 |
| `rules/duplicates.test.ts` | Normalisation: lowercase, diacritics, punctuation, legal forms plc, SA, S.A., S.p.A., AG, Ltd, DAC, B.V., N.V., GmbH; "Santander Consumer Bank GmbH" and "Santander Consumer Bank S.p.A." both give "santander consumer bank"; "Banca Comerciala Romana S.A." matches HVB; trigram similarity threshold 0.85 from config; "banco santander consumer portugal" vs "santander consumer bank" stays below the threshold; same LEI; BIC8 match; deleted records included with "A deleted record with this LEI exists. Ask the admin to reactivate it."; at most 5 matches | R1 |
| `rules/stageEngine.test.ts` | Forward N → N+1 resets days in stage; skip needs a reason and marks "Skipped"; backward needs a reason and is labelled "Stage moved back"; entry date bounds (not future, not before current stage entry); open block survives a stage change; Billable from set at Live & hypercare and removed on a move back with "Billable from date removed"; lifecycle recompute Onboarding / Live / BAU, Inactive untouched; cancelled line excluded from lifecycle and worklists; product lines independent (M6 AC1-AC12, AC19) | R1: forward N → N+1, entry date bounds, open block survives, Billable from set, lifecycle recompute, Inactive untouched, product lines independent. R2: skip, back, "Billable from date removed", cancelled line excluded |
| `rules/coverage.test.ts` | UK CoP needs GB; uniqueness message; Retired → only Onboarding; effective date not before current, max 30 days ahead; Scheduled status keeps the previous status in force until the date (M5 AC4-AC8, AC17) | R1: Retired → only Onboarding; effective date between the current status date and today. R2: UK CoP needs GB on add; uniqueness; max 30 days ahead; Scheduled status |
| `rules/kyb.test.ts` | Chip status Not started, Verified, Expiring (≤90), Expired (past or LAPSED and invalid statuses); review Overdue computed; Completed sets last review and returns to Planned; "No expiry date" never listed (M12 AC8, AC12, edge cases 2, 3, 5) | R1: chip statuses, review Overdue computed, "No expiry date" never listed. R2: Completed sets last review and returns to Planned |
| `rules/notes.test.ts` | 24-hour edit window boundary ("The edit window for this note has closed"); action item row all-or-nothing; due date not in the past when created; Overdue label on Open items past due (M10 AC2, AC3, AC9, AC11, edge case 1) | R1: action item row all-or-nothing; due date not in the past. R2: 24-hour edit window; Overdue label |
| `rules/handoff.test.ts` | Ops → CS entry rule (Ramp-up or BAU, no open handoff); block notes required; commitments or "No open commitments"; send blocked without active Incident contact; Confirmed ticks set Last verified inside the send; resend after decline prefills and clears ticks (M8 AC1-AC9, AC12, resolutions 34, 35) | R1: entry rule, block notes, commitments, Incident contact check, Confirmed ticks. R2: resend after decline |
| `services/audit.test.ts` (database) | One entry per changed field in the same transaction; a failing write leaves no entry; app role cannot `UPDATE` or `DELETE` `AuditEntry`; impersonated writes record the impersonated user and team; create shows "(none)", removal shows "(removed)" (M16 AC1-AC3) | R1 |
| `seed/seed.test.ts` (database) | Runs the seed with `DEMO_CLOCK_START=2026-10-02T09:00:00+03:00` and `GLEIF_SEED_SOURCE=cache`, then asserts every row of the 7.1.15 oracle, the History and audit minimums of 7.1.14, the group tiles of 7.1.5 and the Finance list of 7.1.13 | R1: seed rows, History and audit minimums, group tiles, billing flag results, 7.1.15 oracle rows of R1 sections (Adrian Mine, Emma Mine, Mei), search oracles except contract ID. R2: 7.1.15 rows of R2 sections, "IPE-MSA-2026-014" search oracle |
| `seed/seed.test.ts`, issue flow additions (database) | 7.1.17.5 to 7.1.17.7 field by field; the 7.1.17.8 oracles at both reference times; one hand-over entry after two reads of ISS-1042 past 09:00 CEST; next number ISS-1043 | R1 (from milestone 6A; the oracles from 6C) |
| `rules/issues.test.ts` | **Routing:** owner team for each of the 8 types; named person in hours (Emma Wilson on Revolut Ltd, Monday 08:00 CEST = 14:00 MYT → Kevin Lim); 09:00:00 inside and 18:00:00 outside; no named person in hours → on-call with "No named Ops person on this entity: routed to on-call"; Sev-1 out of hours → on-call (ISS-1042, 03:12 MYT → Kevin Lim); rule 3b (Santander UK plc Sev-1 at 05:30 BST = 12:30 MYT: named Ops person owns and communicates until 09:00 BST, then Sophie Mitchell); customer owner = on-call owner (Zopa Bank Limited) → no hand-over; rule 4 (Revolut Ltd Sev-3 Friday 09 Oct 16:00 CEST → clocks start Monday 12 Oct 09:00 MYT, Emma reads "Clocks start 12 Oct 2026 03:00 CEST, the start of Ops business hours"); rule 4 with no named person → owner set at clock start; Sales owner team in Michael Reed's New York hours; weekend partner Sev-1 → Nora Lee owns and communicates; Sev-1 Billing with a possible breach out of hours → Compliance on-call person owns and communicates (`COMPLIANCE_ON_CALL`), named Finance person added as contributor; no on-call shift → "Issue not reported: no owner could be found..."; default contributors per type, never from on-call; group report → one routed issue per entity. **Business hours, time zones, DST:** the four checked examples of 4.9.3; Emma Wilson's 09:00 is 07:00 UTC on Fri 23 Oct and 08:00 UTC on Mon 26 Oct 2026 (CEST to CET on 25 Oct); Sophie Mitchell's 09:00 is 08:00 UTC before and 09:00 UTC after 25 Oct (BST to GMT); Michael Reed's 09:00 is 13:00 UTC before and 14:00 UTC after 01 Nov 2026 (EDT to EST); a Sev-3 acknowledge clock across the 25 Oct weekend still counts 9 local hours per day; abbreviations "21:12 CEST" and "21:12 CET", "BST" and "GMT", "EDT" and "EST", "MYT", "SGT", fallback "UTC+03:00" for Europe/Bucharest. **Severity and caps:** impact map; breach → Sev-1 over the type cap and the pre-go-live cap (Zopa Bank Limited at UAT → Sev-1, notification 2 h default); Billing "Down" → Sev-2; Revolut Ltd EU VoP / DE at UAT "Down" → Sev-3 with the label; no product line → most advanced stage (Revolut Ltd UK CoP / GB → P15, no cap); no line on the scheme → "no live product on ..."; partner-only never capped; a severity in the request body is ignored. **Clocks:** targets 15 min, 1 h, 540 and 1,620 business minutes; Sev-1 notification from the card, 2 h default with the label; Sev-2 4 business hours of the communicator (ISS-1044 of M19 AC7: due 06 Oct 13:00 MYT); a card edit after the start changes nothing; `clockText` boundaries ("Acknowledge in 9 min", "Notify customer in 1h 20m", "Acknowledge by 12 Oct 2026 16:30 SGT", "Notify customer now", "Overdue by 1 min", never "in 0 min"); header = earliest running clock; queued clocks show no countdown; "Notified before the clock started"; the seed result texts of 7.1.17.5; severity raise (M19 AC14: 12:00 CEST, "Notify customer in 30 min"; raised at 12:20 CEST → "Overdue by 20 min"); severity lowered keeps due times; type change (M19 AC17: Lukas Brenner, "Acknowledge in 1h"; M19 edge case 2). **Fan-out and cascade:** affected customers for Lloyds Bank plc UK CoP / GB at 09:55 CEST (Revolut Ltd 11:55, Santander UK plc 13:55, Lloyds Bank plc 17:55 CEST; Zopa Bank Limited before go-live; Monzo Bank Ltd absent); attach defaults by type; all-or-nothing transaction; children follow the parent's owner on reassign and type change, attached issues keep theirs; acknowledging the parent moves CREATED children to In progress; cascade skips Resolved and Closed children and copies the root cause; unlink; a line going live adds a row with "None". **Hand-over:** `effectiveCommunicator` before and after `handoverAt`; `ensureSystemWrites` twice and in parallel → one entry; note text with and without communications; a record after the hand-over → 403 `communication_handed_over`; a customer owner change writes "Communicator changed to ..." except during an interim period. **Compliance:** reasons; flag kept when severity drops; countdown only at Sev-1; assessor in and out of hours; "Neither". **Template:** ISS-1042 subject and body of M22 AC3 with times in Europe/Rome; "Next update by" rounding; no-contact greeting; the encoded Gmail URL of 4.9.10. **Worklist:** group precedence, order, steps, "+1 more step", count, badge and red badge, rule 4 rows hidden until the start, 7.1.17.8 oracles. **Permissions:** every issue write from every non-role user returns 403 with its code and writes no audit entry. **R2:** absence and backup; severity-down recalculation; facts clock (ISS-1042 23:58 CEST) and breach labels (Lloyds Bank plc PDPA, Santander UK plc GDPR through Banco Santander Totta, S.A., Zopa Bank Limited "Rule not set"); update texts; "Remind customer", automatic closes and the reopen window in the communicator's business days; take over; root cause task dates (Revolut Ltd resolved 05 Oct → 19 Oct 2026; Santander UK plc → 04 Nov 2026) and no second task | R1: everything except the R2 group (milestones 6A to 6C). R2: the R2 group (milestone 12A) |

#### 7.3.2 End-to-end tests (Playwright)

**Release split.** R1 runs four short specs, `tests/e2e/scenario<n>-...-short.spec.ts`, built from the steps of the full specs below as listed in this table. R2 adds the four full specs and `chain.spec.ts` exactly as written below. Both sets use the same setup. The issue flow adds E2E-5 (short in R1 from milestone 6C, full in R2 from 12A) with its own clock setup.

| Spec | R1 short spec: steps used (numbering below) | R2 full spec adds |
|---|---|---|
| E2E-1 | 1 (click "New customer" only), 2 to 7, 9, 10, 11 (Revolut to Ramp-up, decision B14), 12, 13 | step 1 Sales sections; step 8 including the Finance commercial terms Edit control |
| E2E-2 | 1 (type "lloyds", press Enter, click the result row; header assertions unchanged), 3, 5, 6 (without the Role click; same 4 rows and "4 agreements") | step 1 via typeahead; step 2; step 4 incl. the "Network and structure" filter; step 6 with Role = Customer; steps 7 and 8 |
| E2E-3 | 1, 2, 3 (assert "8 of 8 captured" only), 4 (no Field filter; assert the top row only), 6, 7, 8 | step 3 "5 of 8 captured"; step 4 Field filter and count line; step 5; step 9 Change history |
| E2E-4 | 1, 2, 3, 4, 6, 7 (open Adyen from Search, then Reassign owner) | step 5 toggle and "Overdue"; step 7 via "My team"; step 8 |
| `chain.spec.ts` | none | runs as written (Accept is R1, so it can run from milestone 9) |
| E2E-5 | 1, 2, 4 to 12 | step 3 and step 13 (R1-capable); step 14 (R2) |

R1-capable steps left out of the short specs (E2E-2 steps 2, 7, 8; E2E-3 step 5; E2E-4 step 8; E2E-5 steps 3, 13) may be added to the R1 suite if time allows. They are good permission regression checks.

Setup shared by the 4 tests (R1 short and R2 full):
- `webServer` starts the app with `DEMO_MODE=true`, `GLEIF_FORCE_CACHE=true`, `GLEIF_SEED_SOURCE=cache`, `GLEIF_CACHE_PATH=tests/e2e/fixtures/gleif-cache.json`, `DEMO_CLOCK_START=2026-10-02T09:00:00+03:00`. `workers: 1`, tests run serially.
- `beforeEach`: `POST /api/demo/reset` as Adrian Koh, then `page.clock.install({ time: new Date("2026-10-02T09:00:00+03:00") })`.
- Helper `viewAs(team)` uses the switcher in the demo strip. Selectors use roles and visible text from the copy in this brief.
- Every test is independent of the others (scenario order free). One extra spec, `tests/e2e/chain.spec.ts`, runs scenario 1 and then scenario 4 step "Accept Revolut" without a reset in between.

**E2E-1 `scenario1-new-customer.spec.ts`** (R2 full spec. R1: `scenario1-new-customer-short.spec.ts`, steps per the release split table)
1. `viewAs("SALES")`. Home shows "Overdue go-lives" with Zopa Bank Limited and "Champion left" with Santander UK plc. Click "New customer".
2. Choose type Bank, fill LEI `5299000I7Y60A8273788`, blur. Assert "Looking up GLEIF..." then legal name "Santander Consumer Bank GmbH", country AT, status ISSUED, each with "From GLEIF". Group select shows "Santander" with "Suggested from GLEIF parent".
3. Assert the duplicate panel lists exactly 1 row: Santander Consumer Bank S.p.A., reason Name, IT, `549300O0YQXDOJB36Y73`, Customer, owner Emma Wilson, Live, link "Open record". Next is disabled. Tick "I checked these records and this is a different legal entity", type "Austrian sister company with its own LEI and local contract". Next is enabled.
4. Step 2: add EU VoP / AT target 17 Dec 2026 (`today+75`) and Global validation / AT target 30 Jan 2027 (`today+120`). Negative check: set a past date, assert "Target go-live is in the past" and Next disabled, then fix it. Commercial terms EUR, 0.0400, tiers 0-1,000,000 at 0.0400 and 1,000,001-open at 0.0350, payment term 30; SLA 99.95. Assert the contracting entity picker lists the new entity plus the 4 Santander entities.
5. Step 3: champion Katharina Huber, Head of Payments, katharina.huber@scb-at.example, +436641234567.
6. Step 4: picker lists exactly Adrian Koh and Kevin Lim. Pick Adrian Koh, click "Create customer and hand over".
7. Assert the record: header "Owner: Tom Hadley, Sales", banner "Handoff to Adrian Koh pending since 02 Oct 2026", lifecycle Onboarding, amber badge "Incomplete for billing". History contains "Record created by Tom Hadley (Sales)" and "Duplicate warning acknowledged: Austrian sister company with its own LEI and local contract".
8. `viewAs("FINANCE")`. Click the badge. Billing tab banner names the 9 missing fields; the contract reference shows "Owned by Ops" with a link to Details. Open Details, Customer role card: commercial terms show an "Edit" control for Finance (D3); SLA 99.95 and special terms are read-only with "Owned by Sales" (M3 AC15).
9. `viewAs("OPS")`. Home "To pick up" shows Santander Consumer Bank GmbH · AT, EU VoP and Global validation, earliest go-live 17 Dec 2026, from Tom Hadley, 0 days. Open, click "Confirm pickup". Assert owner "Adrian Koh, Ops". Back on Home: row gone without reload; "Required fields empty" lists Santander Consumer Bank GmbH with active Technical contact, active Incident contact and "No contract attached".
10. Products & onboarding: "Change stage" on EU VoP / AT to Kickoff, save. Band shows Kickoff, 0 days in stage; Global validation / AT still Contract signed. Open the group link: group shows "Entities 5".
11. Open Revolut Ltd from "Too long in current stage". Change UK CoP / GB from Live & hypercare to Ramp-up. Assert band at Ramp-up, "Billable from 03 Aug 2026" still shown, EU VoP / DE still UAT with its block. Home: the item is gone.
12. Revolut: click "Hand over to Customer Success". Assert 4 sections. Enter the block note "Customer to deliver certificates, Adrian follows up weekly", add commitment "Weekly status call until full UK CoP volume", tick Confirmed on Oskar Lindqvist and Priya Nair, choose Emma Wilson, "Send handoff". Assert banner "Handoff to Emma Wilson pending since 02 Oct 2026" and owner still Adrian Koh. Home "Awaiting acceptance" lists Revolut Ltd.
13. API check: as Sales, `PATCH` the Revolut stage endpoint returns 403 with `owner_team` "Ops".

**E2E-2 `scenario2-partner-incident.spec.ts`** (R2 full spec. R1: `scenario2-partner-incident-short.spec.ts`)
1. `viewAs("NETWORK")`. Type "lloyds" in the global search, pick the typeahead row (2 interactions). Assert header shows Paul Grant first: `tel:+447700900123` link, copy button, Europe/London local time, "24/7", "Available now", last verified 12 Sep 2026.
2. Click "All incident and escalation contacts". Assert Incident and Escalation groups first; partner context "Owned by Network"; customer context Incident (Ruth Okafor) "Owned by Ops".
3. Partner tab: "Change status" on UK CoP / GB, choose Degraded, reason "Response times above 2s on CoP requests", save. Assert Degraded badge "since 02 Oct 2026, 0 days", status history expandable with Active and Onboarding entries, warning indicator on the partner role chip.
4. Overview: alert "Partner coverage issue: GB / UK CoP Degraded since 02 Oct 2026", counts "Active 1, Degraded 1, Onboarding 1". History: event "Coverage GB / UK CoP: Active → Degraded" by Lukas Brenner, Network, under "Network and structure".
5. Search: clear the text, filter Country GB, Scheme UK CoP. Assert "4 institutions": Revolut Ltd, Santander UK plc, Zopa Bank Limited with "Customer product"; Lloyds Bank plc with both chips and "Degraded". Assert the URL holds the filters.
6. `viewAs("COMPLIANCE")`. Assert the same URL and filters. Switch to "Obligations", Role Customer, sort Incident notice ascending. Assert rows in order Revolut Ltd 2, Santander UK plc 4, Lloyds Bank plc 8, Zopa Bank Limited "Not captured"; count "4 agreements". Assert the Revolut contract link has `target="_blank"` and an approved host.
7. Open Zopa Bank Limited, Compliance tab, Customer agreement "Edit": enter 4.5, assert "Enter a whole number of hours between 1 and 720"; enter 24, save. Assert "8 of 8 captured" and "Last updated by Mei Chen (Compliance), 02 Oct 2026".
8. `viewAs("OPS")`. Lloyds Partner tab: Degraded row visible, "Owned by Network", no "Change status" button. API: Ops `POST` coverage status returns 403 with `owner_team` "Network".

**E2E-3 `scenario3-audit.spec.ts`** (R2 full spec. R1: `scenario3-audit-short.spec.ts`)
1. `viewAs("COMPLIANCE")`. Home "KYB and review expiries": Overdue contains Banco Santander Consumer Portugal S.A. "LEI lapsed in GLEIF" and Banca Monte dei Paschi di Siena S.p.A. "Periodic review overdue since 27 Sep 2026"; ≤30 days contains Adyen "Licence expires in 23 days (25 Oct 2026)" and, from the frozen fixture, HVB "LEI renewal in 20 days (22 Oct 2026)"; 31-60 contains Banco Santander Totta, S.A. review; 61-90 contains Zopa licence.
2. Open the Adyen item. Assert 4 KYB cards: Licence "Expiring"; LEI, Ownership structure, Sanctions screening "Verified by Mei Chen on 01 Nov 2024" (`today-700`) with evidence links; periodic review Planned.
3. "Update verification" on Licence: DNB-BL-0412, De Nederlandsche Bank, expiry 31 Mar 2028, verified today, evidence `https://drive.example.com/adyen-licence.pdf`, save: assert "Use a link to approved document storage" and nothing saved. Replace with `https://docs.corvane-internal.example/adyen/licence-2026.pdf`, save: chip Verified, toast "Verification saved". Assert obligations cards "8 of 8 captured" and "5 of 8 captured".
4. Audit tab: filter Field "Expiry date". Assert the top row: object "KYB: Licence", old 25 Oct 2026, new 31 Mar 2028, Mei Chen, Compliance, timestamp with "(UTC+03:00)"; the `today-700` entries below; the count line updates.
5. `viewAs("SALES")` on the same URL. Assert redirect to Home with "You don't have access to that page as Sales" (Audit tab). Open Adyen Compliance tab: lock icons, "Owned by Compliance", no edit buttons, evidence link clickable, no Audit tab. API: Sales `PATCH` KYB returns 403 `{"error":"forbidden","owner_team":"Compliance"}` and the audit count is unchanged.
6. `viewAs("COMPLIANCE")`. Admin menu shows only "Roles & permissions". Open it: matrix with 6 team columns, E and R cells, text "Generated from the permission matrix the server enforces. Read-only." Compare every cell with the matrix module (`import { PERMISSION_MATRIX }`).
7. `viewAs("OPS")`. Open Monzo Bank Ltd, header menu "Delete record". "Delete" disabled with 9 characters, enabled at 10. Reason "Created twice during the CRM import", confirm. Assert red banner "Deleted by Adrian Koh on 02 Oct 2026. Reason: Created twice during the CRM import". Search "monzo": no results. As Emma, the Monzo URL shows "This record was deleted on 02 Oct 2026. Contact the admin, Adrian Koh, if it should be restored."
8. As Adrian: Admin > Deleted records lists Monzo Bank Ltd first and Lloyds Bank (legacy import). "Reactivate", confirm "Reactivate Monzo Bank Ltd? All its data returns to search and worklists." Assert owner Ethan Brooks, Global validation / GB at Kickoff, search "monzo" returns 1 row, Audit tab shows Record status Active → Deleted with the reason and Deleted → Active.
9. Admin > Users & roles: Change history first row "Nora Lee · Customer Success → Network · Adrian Koh" dated 02 Sep 2026.

**E2E-4 `scenario4-csm-day.spec.ts`** (R2 full spec. R1: `scenario4-csm-day-short.spec.ts`)
1. `viewAs("CS")`. Assert Home badge "1", scope "Mine". "Ownership assigned to you": UniCredit Bank GmbH from Leo Martin, reason "Rebalancing German accounts before Q4". "Renewals in the next 120 days": HVB "Renewal date passed (22 Sep 2026)" Overdue first, MPS "Renewal in 75 days (16 Dec 2026)" 61-90 days.
2. Click "Acknowledge" on HVB. Row leaves without reload, badge hidden. Audit (as Mei via API or as admin) has the acknowledgement entry.
3. Click "Open" on the MPS renewal row. Lands on Details, Customer role card, renewal date editable for Emma; contract reference read-only "Owned by Ops"; handoff summary "Owned by Sales".
4. Overview: 3 products at BAU, Ramp-up, Live & hypercare; key people with last verified; "Latest interactions" has 5 entries; alert "Periodic review overdue since 27 Sep 2026".
5. History: at least 12 items with authors from Sales, Ops, CS, Network and Finance. Toggle "Open action items only": the Payment note by Rachel Wong remains with its item labelled "Overdue".
6. "Add note": type QBR, date today, participants Emma Wilson, Tom Hadley, Giulia Ferri; summary "Q3 review, volumes on track in DE. MPS asked for a renewal proposal with DE volume tiers before the renewal date."; action items "Send renewal proposal with DE volume tiers" Tom Hadley 16 Oct 2026 and "Share EU VoP / DE ramp-up plan" Emma Wilson 09 Oct 2026. Negative check: summary of 10 characters shows an inline error. Save. Assert the note is first in the timeline and first in Overview "Latest interactions".
7. Home, toggle "My team". Assert Adyen row "Renewal in 100 days" 91-120 days, owner Leo Martin. Open it, "Reassign owner": picker lists CS users first; reason "short" shows "Reason is required (minimum 10 characters)"; choose Sophie Mitchell, reason "Leo on parental leave until February 2027", "Reassign". Assert toast "Owner changed to Sophie Mitchell", header "Owner: Sophie Mitchell, Customer Success" since 02 Oct 2026, History "Owner reassigned" with the reason.
8. `viewAs("OPS")` on Adyen: no "Reassign owner" button, lock tooltip "Owned by Customer Success". API: Ops reassign returns 403.

**`chain.spec.ts`** (R2; scenarios 1 then 4): after E2E-1 step 12 without reset, `viewAs("CS")`, "To pick up" shows "Revolut Ltd · GB | From Adrian Koh | 0 days pending". Open, "Accept". Owner becomes Emma Wilson; Hannah Clarke keeps "Owned by Sales and Customer Success"; the row leaves; Adrian's "Awaiting acceptance" is empty.

**E2E-5 `scenario5-issue-flow.spec.ts`** (issue flow, from milestone 6C; R2 full spec. R1: `scenario5-issue-flow-short.spec.ts`, steps per the release split table)

Setup: a second Playwright project `issues` with its own `webServer` on port 3101 and the shared environment except `DEMO_CLOCK_START=2026-10-05T08:05:00Z` (Monday 05 Oct 2026: 10:05 CEST, 16:05 MYT and SGT, 09:05 BST). `beforeEach` resets as Adrian Koh and calls `page.clock.install({ time: new Date("2026-10-05T08:05:00Z") })`. The server clock runs, so running clock texts are asserted with patterns such as `/Notify customer in 1h \d+m/`. The Gmail host is stubbed with `context.route("https://mail.google.com/**", r => r.fulfill({ body: "ok" }))`. The Lloyds Bank plc partner issue of scenario 2 (M23) is created live here; E2E-2 stays as written.

1. `viewAs("CS")`. Home: "Issues" is the first section, title "Issues (2)", rows ISS-1042 then ISS-1031, each "Communicator" with no step; Home badge "1". Open ISS-1042: "Communicator: Emma Wilson (Customer Success)", "Corvane aware at 04 Oct 2026 21:12 CEST", Clocks panel "Acknowledged 9 min after report (target 15 min)" and "Notified 53 min after Corvane aware at (target 6h)", Compliance block "Possible major incident. Assessed by Mei Chen (Compliance) at 21:58 CEST.", first log entry (grey) "Communication handed over to Emma Wilson at 09:00 CEST. Already communicated: First notification by Email to Silvia Moretti at 22:05 CEST by Kevin Lim. Owner: Kevin Lim." Reload: the entry exists once. MPS History shows "ISS-1042: communication handed over to Emma Wilson at 09:00 CEST".
2. Open Revolut Ltd, Issues tab, "Report issue". Type "Wrong match result", product line "UK CoP / GB, Live & hypercare": scheme and country locked to UK CoP and GB. The similar issues block lists "ISS-1038 · Wrong match result · Sev-2 · In progress · Kevin Lim (Ops) · 3 days". Description "Payee 'Harbour Bakery Ltd' returns No match for the trading name 'Harbour Bakery'. 6 cases since 09:00.", Corvane aware at 05 Oct 2026 10:00, reported by Priya Nair, impact "Isolated case", possible data breach "No": "Proposed severity: Sev-3 (Isolated case)". "Report issue". Assert URL `/issues/ISS-1043`, banner "Issue ISS-1043 reported", "Owner: Kevin Lim (Ops)", "Communicator: Adrian Koh (Ops)", "Contributors: Lukas Brenner (Network)", "Why this owner: Revolut Ltd's named Ops person, inside Ops business hours", acknowledge due `/06 Oct 2026 10:0\d CEST/`. Revolut History: "Issue ISS-1043 reported by Emma Wilson (Customer Success): Sev-3, Wrong match result, UK CoP GB". Home: ISS-1043 under "Reported by me".
3. Revolut Ltd, "Report issue" again: product line "EU VoP / DE, UAT", impact "Down": "Capped at Sev-3: EU VoP / DE is at UAT, before go-live. No customer notification clock starts." Possible data breach "Yes": "Proposed severity: Sev-1 (Possible data breach)" and no cap line. Clear the product line, scheme and country, type "Billing", breach "No", impact "Down": "Highest severity for this type: Sev-2". Cancel; the Issues tab is unchanged.
4. API: as Emma, `POST /api/issues/ISS-1043/acknowledge` returns 403 with code `not_issue_owner`; ISS-1043 stays New; no audit entry is written.
5. `viewAs("NETWORK")`. Open Lloyds Bank plc, "Report issue": type "Partner degraded or unavailable", scheme UK CoP, country GB, description "Lloyds CoP responses above 2 seconds and timeouts since 09:50 CEST", Corvane aware at 05 Oct 2026 15:55 (SGT, = 09:55 CEST), "Found by Corvane", impact "Down", breach "No". Save. Assert ISS-1044, Sev-1, "Owner: Lukas Brenner (Network)", "Communicator: Lukas Brenner (Network)", status New, `/Acknowledge in 1\d min/`, "Partner agreement incident notification time: 1 h". Banner "Coverage UK CoP / GB is Active. Set it to Degraded?": "Set to Degraded" opens the M5 dialog with Degraded, today and a reason starting "ISS-1044: Lloyds CoP responses"; save; banner `/Coverage UK CoP \/ GB set to Degraded by Lukas Brenner at 16:\d\d SGT/`. Click "Acknowledge": `/Acknowledged by Lukas Brenner at 16:\d\d SGT/`, toast "Issue acknowledged".
6. "Affected customers (3)": Revolut Ltd (UK CoP / GB, Live & hypercare, Adrian Koh, 2 h, Notify by 17:55 SGT), Santander UK plc (BAU, Sophie Mitchell, 4 h, 19:55 SGT), Lloyds Bank plc (BAU, Adrian Koh, 8 h, 23:55 SGT); "Not affected: before go-live (1)" holds Zopa Bank Limited, UK CoP / GB, UAT. "Create linked issues": the Revolut Ltd row lists ISS-1038 and ISS-1043 with "Create a new linked issue" selected. "Create". Assert ISS-1045 (Revolut Ltd), ISS-1046 (Santander UK plc), ISS-1047 (Lloyds Bank plc), each Sev-1, In progress, "Why this owner: inherited from partner issue ISS-1044"; "Linked issues (3)" and "Customers notified 0 of 3".
7. On ISS-1044 click "Open in Gmail": the new page URL starts with `https://mail.google.com/mail/?view=cm&fs=1&to=paul.grant%40lloyds.example&su=%5BCorvane%5D%20Sev-1%20incident%20ISS-1044%3A%20UK%20CoP%20GB`; the hint "Sent it? Record the notification" shows. "Record notification": "First notification", Phone, Paul Grant, message "Called Paul Grant: CoP responses above 2 seconds, investigating with your service desk." Toast "Notification recorded".
8. `viewAs("OPS")`. Home "Issues (4)": ISS-1045 (Revolut Ltd, "Communicator", `/Notify customer in 1h \d+m/`), ISS-1047 (Lloyds Bank plc, `/Notify customer in 7h \d+m/`), then ISS-1038 and ISS-1043 with no step. Open ISS-1047: banner "This entity is also the affected partner" and `/Network last contacted the partner at \d\d:\d\d MYT: Paul Grant, phone/`; incident contact Ruth Okafor; subject "[Corvane] Sev-1 incident ISS-1047: UK CoP GB". "Record notification": Email, Ruth Okafor, prefilled body. Clocks panel `/Notified \d+ min after Corvane aware at \(target 8h\)/`.
9. `viewAs("COMPLIANCE")`. Home "Issues (3)": ISS-1045, ISS-1046, ISS-1047, each "Assess for Compliance" with `/Assess in \d+ min/`. Open ISS-1045: "Flagged for Compliance: Sev-1 at a regulated customer (UK FCA)". "Record assessment": "Possible major incident", rationale "Material CoP outage for a UK FCA customer." Save: `/Possible major incident\. Assessed by Mei Chen \(Compliance\) at \d\d:\d\d SGT\./`. Home "Issues (2)".
10. `viewAs("NETWORK")`. ISS-1044, "Change status", Resolved: root cause "Lloyds CoP gateway overloaded after a configuration change on their side.", solution "Lloyds rolled back the change at 10:40 CEST; response times back under 1 second." Confirm "Resolve ISS-1044 and 3 linked issues?". The panel shows the three children Resolved; ISS-1046 has the note "Resolved with partner issue ISS-1044 by Lukas Brenner (Network)".
11. `viewAs("OPS")`. Home: ISS-1047 "Close with the customer"; ISS-1045 "Notify customer" with its clock and "+1 more step". Open ISS-1047, "Close": Ruth Okafor, Email, now. Status Closed; the row leaves Home.
12. API: as Adrian, `POST /api/issues/ISS-1044/status` returns 403 `not_issue_owner`; as Emma, `POST /api/issues/ISS-1045/compliance-assessments` returns 403 with `owner_team` "Compliance"; as Lukas, `POST /api/issues/ISS-1045/close` returns 403 `not_communicator`. The audit count is unchanged after each.
13. `viewAs("FINANCE")`. Open ISS-1031, "Change severity": Sev-1 disabled with the tooltip "Highest severity for this type: Sev-2"; choose Sev-2, reason "Customer escalated: payment blocked until corrected". Toast "Severity changed to Sev-2"; the notification row, recalculated from Corvane aware at with 4 business hours of Emma Wilson, shows `/Overdue by \d+ days/` in red (M19 AC14).
14. (R2) `viewAs("OPS")`. Open ISS-1047 (Closed in step 11), "Reopen" with reason "Customer reports the same timeouts again": status In progress, log entry "Reopened by Adrian Koh: Customer reports the same timeouts again". Open ISS-1045: Clocks panel `/Send facts pack in 3h \d+m/` (Revolut Ltd, 4 h from the step 9 assessment); "Record notification" with type "Facts pack sent" gives `/Facts pack sent \d+ min after Possible major incident \(target 4h\)/`; the Root cause report block reads "Root cause report due 19 Oct 2026 (in 14 days)", read-only for Adrian (owner Lukas Brenner). ISS-1046 reads "Root cause report due 04 Nov 2026 (in 30 days)"; ISS-1044 has no Root cause report block.

---

### 7.4 Build plan

Each milestone ends with `npm run lint`, `npm run typecheck`, `npm test` green and a commit. The build runs in two releases (decision B9): R1 milestones 1 to 8 (with the issue milestones 6A, 6B and 6C between 6 and 7), then the gate, then R2 milestones 9 to 13 (with 12A) only when the Product Owner says so. The issue milestones start only when the PO says so (decision B15); milestones 1 to 3 were built before the issue flow existed, and milestone 6A adds its migration. Each R1 milestone delivers only R1 ACs. "(part)" means a split AC; the part each release delivers is named in 7.6.3. The dependency guards of 7.6.9 apply throughout R1.

#### 7.4.1 Release 1 milestones

| # | Milestone | Scope | Stories and ACs delivered | Done when |
|---|---|---|---|---|
| 1 | Scaffold, tokens and shell | Next.js App Router + TypeScript, Tailwind with brand tokens as CSS variables, DM Sans, shadcn/ui restyled, docker compose Postgres with the 2 roles, `src/lib/dates.ts` (clock), S0 shell (demo strip, top bar with global search bar where Enter opens S2, user menu, toasts, access and not-found pages). No typeahead | M1 AC1 (bar present), M15 AC11 (switcher UI stub), resolution 61 copy | `docker compose up` + `npm run dev` shows the shell at 1024 px and 1440 px with no horizontal scroll; Vitest and Playwright run one smoke test each |
| 2 | Data model, full seed and demo mode | Full Prisma schema (every model and enum of 3.2 and 3.3, including fields only R2 writes), migrations incl. audit grants and `pg_trgm`, GLEIF client + cache + `gleif:snapshot` + `gleif:check`, full seed 7.1 with every audit entry and History event, `db:reset`, "View as" endpoint and cookie, Reset demo data endpoint and seed version | M15 AC1, AC2, AC11; M16 AC3, AC16; resolutions 1-6 | `npm run db:reset` loads all of 7.1; the R1 cases of `seed.test.ts` pass (7.3.1); switching "View as" changes the signed-in user |
| 3 | Read paths (R1): search, entity record, group | S2 search with Country and Scheme filters, partner chips, relevance sort, 25-row paging and URL state; Obligations view with Customer rows, Incident notice filter and both sortable columns; S4.0 header (partner incident block with local time and availability, owner block, billing badge, pending banners); every S4 tab read-only (Overview, Details, Products, Contacts with Former contacts collapsed, History timeline with the M10 AC8 default set applied on the server, Partner, Compliance with all four KYB cards and the review card, Billing); S5 group record | M1 AC2-AC4, AC5 (part), AC6-AC8, AC9 (part), AC10-AC17, AC19, AC20; M4 AC1, AC2, AC16; M5 AC1, AC9, AC11, AC12, AC16; M6 AC1, AC11 (part, display), AC13, AC20; M7 AC6 (part), AC10, AC11; M10 AC5-AC7; M12 AC1, AC8, AC11 (part), AC12 (part), AC15; M13 AC1 (part, display), AC3, AC8, AC9 (part), AC10 (part), AC12, AC13; M14 AC1 (part), AC6-AC9, AC12 (part), AC13, AC15 | Every search oracle in 7.1.15 except contract ID holds; every tab renders seed data with no empty tab on scenario entities; Lloyds header shows Paul Grant with local time and "Available now" |
| 4 | Permissions, audit and admin (R1) | Policy module from the M15 AC3 matrix; server guard on every write route; "Owned by <Team>" rendering; service layer writing audit entries in the same transaction; Audit tab list, newest first, 50 per page with Load more; Admin menu (Deleted records, Roles & permissions, Reset demo data); Roles & permissions page; soft delete; reactivation with the reused-LEI block (guard 5) | M15 AC3, AC4, AC7-AC9, AC12 (part), AC13; M16 AC1, AC2, AC4, AC5, AC8-AC14; resolutions 56, 57 (R1 block), 59 | `permissions.test.ts` and `audit.test.ts` pass; a forged request from each wrong team returns 403 and writes nothing; Roles & permissions equals the matrix module; Monzo Bank Ltd reactivates; Lloyds Bank (legacy import) is blocked with the guard 5 message |
| 5 | Edits per tab (R1) | Details: Edit roles (add only), Attach contract (new entity contract), Link entity (standalone entities only), Unlink, Edit renewal date (CS); Products: Change stage (N+1 only), Mark as blocked, Resolve block, "Billable from" on entry to Live & hypercare; Contacts: Add contact and Edit contact drawer with time zone and availability (B12), Mark as verified; Partner: Change status with effective date no later than today; Compliance: Licence Record verification with evidence link, LEI Refresh from GLEIF, Customer agreement obligations Edit; History: Add note drawer with participants and action items (saved as Open); Reassign owner | M3 AC15; M4 AC3, AC5, AC7 (part), AC9 (part), AC12-AC15; M5 AC7, AC8, AC10, AC13-AC15; M6 AC2-AC4, AC7, AC8 (part), AC9, AC10 (part), AC11 (part), AC12, AC14-AC17; M7 AC1, AC2 (part), AC3-AC5, AC9 (part), AC14, AC15; M9 AC1-AC8; M10 AC1-AC4, AC12; M12 AC2, AC3, AC6, AC7, AC9, AC10, AC13, AC14, AC16; M13 AC2, AC4-AC6, AC14 | R1 cases of the 7.3.1 rule tests for these areas pass; E2E-2 short spec passes |
| 6 | New customer wizard, GLEIF and duplicates (R1) | S3 steps 1-4; GLEIF lookup with live, timeout and cache; LEI status handling (LAPSED and PENDING_* amber with continue, invalid statuses block Next, "GLEIF unavailable" blocks Next for LEIs outside the cache); country check; group suggestion from the GLEIF parent; duplicate service and panel with reason; submit transaction; Sales → Ops pending banner. Leaving the wizard discards its data with no dialog | M2 AC1-AC5, AC7 (part), AC8 (part), AC9-AC12, AC14, AC17, AC18 (part), AC19; M3 AC1-AC3, AC5-AC9, AC10 (part), AC13 (part, banner), AC16, AC17 | `duplicates.test.ts` passes; E2E-1 short steps 1-7 pass; GLEIF offline (`GLEIF_FORCE_CACHE=true`) still fills the SCB GmbH record |
| 6A | Issue model, routing and clocks (R1) | Migration `0003_issue_flow` with every model, enum, field and SQL object of 3.2.6 (R2 fields included) and the grants rerun; issue seed 7.1.17 with its audit entries and History events; constants 3.3.5 and 3.3.6; `lib/business-hours.ts` and `lib/time-zones.ts`; severity proposal and caps; routing rules 1 to 8 with business hours, issue team and on-call; clock storage and on-read computation with texts; severity and type change services with recalculation; Compliance flag evaluation on the server; issue team defaults in the customer-create service; matrix rows 31 to 34 and the Roles & permissions snapshot; `INCIDENT` History category; report and group-report endpoints (no UI yet); Regulatory block on the Customer agreement card; read-only Issue team block on Details | M18 AC1-AC8, AC11; M19 AC1-AC9, AC12, AC14, AC15, AC19, AC20; M26 AC1-AC8, AC10 | The routing, business-hours (time zones and DST), severity, cap and clock cases of `issues.test.ts` pass; `seed.test.ts` holds 7.1.17.5 to 7.1.17.7; at the E2E-5 clock, `POST /api/entities/{revolut}/issues` with the M17 AC10 values returns ISS-1043 owned by Kevin Lim, communicator Adrian Koh, contributor Lukas Brenner; the MPS Customer agreement card shows "3 of 3 captured" in the Regulatory block and a Sales edit returns 403; `permissions.test.ts` passes with rows 31 to 34 |
| 6B | Report, Issue page and communication (R1) | Report issue panel on the entity (header and Issues tab) and on the group record, similar issues, "Add to existing issue", live proposed severity; entity Issues tab; Issue page `/issues/[issueId]` with header, banners, Clocks panel, People panel, Notes and Resolution; owner actions (Acknowledge, Change status, Resolve and back to work, Change severity, Change type, contributors, Reassign); Communication section (incident contact block, prefilled template, "Copy message", "Open in Gmail", Record notification and update, log, Close); effective communicator, hand-over system writes on read, `onCustomerOwnerChanged()` in the M9 reassign service; Customer obligations block; "Incident" History events with links; issue 403 codes | M17 AC1-AC13; M18 AC9; M19 AC13, AC17, AC18; M21 AC1-AC12; M22 AC1-AC12, AC18, AC19 | The hand-over, template, Gmail URL and permission cases of `issues.test.ts` pass; two reads of ISS-1042 after 09:00 CEST write one hand-over entry; E2E-5 short steps 1 (without the Home assertions), 2 and 4 pass; a forged owner or communicator action from each other role returns 403 and writes nothing |
| 6C | Partner issue, Compliance and Issues worklist (R1) | Partner issue: Degraded proposal with the prefilled M5 dialog, Affected customers and "Not affected: before go-live", Create linked issues and attach in one transaction, Linked issues panel, owner sync, cascade resolution, unlink, dual-role banner; Compliance block with flag reasons, assessor, assessment clock and Record assessment; Home "Issues" section first for every team with Contributing and Reported by me, steps, order, count, badge contribution and 60-second refresh. Milestone 7 builds Home: until then 6C renders the section at the top of `/` and milestone 7 adds the M11 sections below it | M18 AC10; M20 AC1-AC13; M23 AC1-AC17; M25 AC1-AC8, AC11 | The fan-out, cascade, Compliance and worklist cases of `issues.test.ts` pass; the 7.1.17.8 oracles hold for every "View as" user; E2E-5 short passes except the Home badge assertion of step 1, which joins at milestone 7 |
| 7 | Handoffs and worklists (R1) | S6 View A (Confirm pickup), View B (Ops → CS form and send), View C (summary and Accept); S1 Home on the "Mine" scope (Compliance: all institutions) with the R1 sections of 7.6.5 below the "Issues" section of 6C, Home badge (M9 count plus issue steps, 4.6.9), summary strip, inline Acknowledge, refresh after action; "Your worklist is clear" for Network, Finance and Sales when their M11 sections are empty; Confirm pickup and Accept call `onCustomerOwnerChanged()` (4.9.7) | M3 AC11, AC12, AC18 (part); M8 AC1-AC9, AC10 (part), AC11, AC14, AC15 (part), AC16, AC17; M9 AC9, AC10 (part), AC12; M11 AC1, AC2, AC3 (part), AC4, AC5 (part), AC6-AC9, AC10 (part), AC11-AC13, AC19-AC22, AC23 (part), AC25 | R1 cases of `worklists.test.ts` and `handoff.test.ts` pass; E2E-1, E2E-3, E2E-4 and E2E-5 short specs pass; a service test accepts a Revolut Ltd handoff to Emma Wilson and finds ISS-1038's communicator changed with the log entry "Communicator changed to Emma Wilson: customer owner changed" |
| 8 | Polish and demo readiness (R1) | Every "States" block in sections 5 and 6 for R1 screens and controls (loading, empty, error, read-only), the issue screen states of 6.13.9, 1024 px layouts, copy review against the brief and design brief section 6, pre-demo script for the short scenarios and the issue flow, README with demo steps | States and edge cases in Appendix A and Appendix B that belong to R1 ACs (7.6.3, 7.6.12) | The gate checklist below runs clean, E2E-5 short included |

#### 7.4.2 Gate: R1 demo-ready

The build stops here and reports to the Product Owner. R1 is demo-ready when every item holds:

1. The 5 short Playwright specs (E2E-1 to E2E-5 short, 7.3.2) are green 3 runs in a row from a clean `npm run db:reset`.
2. Every R1 case in 7.3.1 passes; `npm run lint` and `npm run typecheck` are clean.
3. The 7.2.5 pre-demo checklist runs clean, using the short scenario script.
4. Each short scenario runs twice in a row after "Reset demo data", in any order.
5. A forged write from each wrong team returns 403 and writes nothing (checked in milestone 4, rerun here).
6. No console errors and no unhandled promise rejections on the short scenario paths.
7. Layouts hold at 1024 px and 1440 px on every R1 screen.
8. Issue flow: the 7.1.17.8 oracles hold before and after 09:00 CEST on the demo day, and reading ISS-1042 after 09:00 CEST writes exactly one hand-over entry.

Report to the PO: the checklist results, the test results, the R1 limits a presenter must know (7.6.4), and the entries added to `DECISIONS.md` during R1. Then wait. Continue to milestone 9 only when the PO says so; otherwise R1 is the demo build.

#### 7.4.3 Release 2 milestones

Each R2 milestone lifts the dependency guards (7.6.9) that its ACs replace, and brings its own audit entries and History events through the same service layer.

| # | Milestone | Scope | Stories and ACs delivered | Done when |
|---|---|---|---|---|
| 9 | Read paths, audit and admin (R2) | Search typeahead in S0; Role, Stage, Coverage status, Lifecycle and Owner filters; user sorts; contract ID matching; Obligations Partner rows, Subprocessor notice filter, "Only rows where this is not captured"; History filter bar; Audit filters (Field, User, Date range), count line and "Expand"; Admin "Users & roles" page with Change team, Add user and Change history; generic 403 toast and read-only re-render; reactivation with a reused LEI (lifts guard 5) | M1 AC5 (part), AC9 (part), AC18; M10 AC8; M13 AC9 (part), AC10 (part), AC11; M15 AC5, AC6, AC10, AC12 (part), AC14; M16 AC6, AC7, AC15 | Every search oracle in 7.1.15 holds, including contract ID; E2E-2 full spec passes |
| 10 | Edits per tab (R2) | Details: entity core edit, role removal (lifts guard 1), master agreement option and a different invoiced entity, Attach partner agreement, Mark as Inactive, commercial terms, SLA, special terms and handoff summary edit (incl. Finance on commercial terms, D3); S5: Move entity (lifts guard 2), Create and Edit group; Products: skip and back moves (lifts guard 3), Edit block, Edit target go-live, Add, Edit and cancel product line; Contacts: Mark as left, Set as primary, duplicate warning, "Copy details from"; Partner: Add coverage, Edit connection method, Scheduled status (lifts guard 4), Partner agreement summary; Compliance: Ownership and Sanctions verification, Schedule and complete review, Partner agreement card, obligation expiry badge; Billing: Create and Edit billing profile; History: Edit note (24 h), action item toggle, "Open action items only"; header assignment banner with Acknowledge | M2 AC16; M3 AC14; M4 AC4, AC6, AC7 (part), AC8, AC9 (part), AC10, AC11; M5 AC2-AC6, AC17; M6 AC5, AC6, AC8 (part), AC10 (part), AC11 (part), AC18, AC19, AC21; M7 AC2 (part), AC6 (part), AC7, AC8, AC9 (part), AC12, AC13; M9 AC10 (part), AC11; M10 AC9-AC11; M12 AC4, AC5, AC11 (part), AC12 (part); M13 AC1 (part), AC7; M14 AC1 (part), AC2-AC5, AC10, AC11, AC12 (part), AC14 | Every rule test in 7.3.1 for these areas passes, R2 cases included; E2E-3 full spec passes |
| 11 | Wizard (R2) | Discard dialog; country override; invalid-status override and "Use successor LEI"; "Create group from GLEIF parent" and the mismatch warning; "Add Customer role to this existing entity"; "Contracted entities not yet in the portal"; manual entry when GLEIF is unavailable with "Not verified with GLEIF" and the header "Retry GLEIF lookup" (lifts guard 7); "Change Onboarding Manager" | M2 AC6, AC7 (part), AC8 (part), AC13, AC15, AC18 (part); M3 AC4, AC10 (part), AC13 (part) | E2E-1 full steps 2-7 pass; a non-cached LEI with GLEIF unreachable completes through manual entry |
| 12 | Handoffs and worklists (R2) | Ops → CS Decline, Cancel handoff and resend with prefill; "Mine / My team" toggle, Sales "created by" scope, resolution 10; "Waiting <n> days" pin and highlight (business days); sections Ops "Handoff declined", Network, Finance and Sales | M3 AC18 (part); M8 AC10 (part), AC12, AC13, AC15 (part); M11 AC3 (part), AC5 (part), AC10 (part), AC14-AC18, AC23 (part), AC24 | All cases of `worklists.test.ts` and `handoff.test.ts` pass; E2E-1, E2E-4 full specs and `chain.spec.ts` pass |
| 12A | Issue flow (R2) | "Absent until" with backup routing; severity-down recalculation; facts and data breach clocks with "Facts pack sent" and "Breach notification"; update cadence and "Send update"; "Remind customer"; both automatic closes as on-read system writes; Reopen within 10 business days and "Report a new issue linked to <ID>"; Take over communication; "Post-incident report due (days)" rendered with its counter; root cause report task with "Record report sent"; the R2 Home steps (4.6.9) | M18 AC12; M19 AC10, AC11, AC16; M20 AC14; M21 AC13, AC14; M22 AC13-AC17, AC20; M25 AC9, AC10; M26 AC9; M27 AC1-AC7 | All cases of `issues.test.ts` pass, R2 included; E2E-5 full spec passes; no migration added |
| 13 | Polish and demo readiness (R2) | Every remaining "States" block in sections 5 and 6, edge cases of R2 ACs, copy review of R2 screens, pre-demo script for the full scenarios, README update | All remaining States and Edge cases in Appendix A and Appendix B | All 5 full E2E specs (E2E-1 to E2E-5) and `chain.spec.ts` pass 3 runs in a row; the 7.2.5 checklist runs clean; 7.5.1 definition of done holds |

#### 7.4.4 Scenario readiness

| Scenario | Short version (R1) runnable after | Full version (R2) runnable after | Why |
|---|---|---|---|
| 2 Partner incident | Milestone 5 | Milestone 9 | Short needs search with filters (3), permissions (4) and the coverage status change (5); it has no Home step. Full adds typeahead, the History filter and the Role filter (9) |
| 3 Audit and due diligence | Milestone 7 | Milestone 10 | Short steps 2-8 work after milestone 5; step 1 needs the Compliance worklist (7). Full adds Users & roles and Audit filters (9) and the Partner agreement card (10) |
| 4 A day in the life of a CSM | Milestone 7 | Milestone 12 | Starts on Home with the assignment item and renewals. Full adds "Open action items only" (10) and "My team" (12) |
| 1 New customer end to end | Milestone 7 | Milestone 12 | Short needs the wizard (6), then "To pick up", the Revolut move to Ramp-up and the Ops → CS handoff (7). Full adds the Finance commercial terms Edit (10) and the Sales sections (12) |
| 5 Issue flow (E2E-5) | Milestone 7 | Milestone 12A | Short needs the report and the Issue page (6B), the partner issue, Compliance and the Issues section (6C), and the Home badge with the M9 count (7). Full adds the R2 clocks, reopen and the root cause task (12A) |

---

### 7.5 Definition of done and out of scope

#### 7.5.1 Definition of done (MVP)

This list is the done-when for the full build at the end of R2 (milestone 13). R1 is done at "Gate: R1 demo-ready" (7.4.2).

1. Every AC in Appendix A for M1 to M16 is implemented, or is listed below as phase 2 by its own "Out of scope" block. Every AC in Appendix B for M17 to M27 is implemented (M24 is phase 2 with no ACs).
2. Every write route checks the M15 AC3 matrix on the server and returns 403 with `{"error":"forbidden","owner_team":"<Team>"}`; the UI hides controls the user cannot use and renders "Owned by <Team>".
3. Every write goes through the service layer and writes its audit entries in the same transaction; the app database role cannot update or delete audit entries.
4. All unit tests in 7.3.1 and all Playwright specs in 7.3.2 pass from a clean `npm run db:reset`.
5. `docker compose up`, `npm install`, `npm run db:reset`, `npm run dev` bring up the demo with `DEMO_MODE=true` on a fresh machine, documented in the README.
6. The 4 scenarios run in any order after "Reset demo data", and each runs twice in a row after a reset between runs.
7. The wizard works with GLEIF unreachable (cache answers for the demo LEIs; other LEIs reach the "GLEIF unavailable" state).
8. Screens follow the brand tokens, DM Sans, British spelling and sentence case; no demo data banner; layouts hold at 1024 px and 1440 px.
9. Every screen has its loading, empty, error and read-only state from Appendix A.
10. No console errors and no unhandled promise rejections on the scenario paths.

#### 7.5.2 Out of scope (phase 2 backlog)

| Item | Source |
|---|---|
| Merge duplicate records | M2, M4, M16 out of scope (O5) |
| One-click restore of a field value from the audit log | M12, M16 out of scope (O12) |
| CSV export of the audit log, the Obligations view, search results and the handoff summary; access review export | M1, M8, M12, M13, M15, M16 out of scope (CO8) |
| Generated list of customers affected by a partner incident from routing data | M1, M4, M5, M11, M13 out of scope (N6) |
| Subprocessor change notification generator with deadlines | M13 out of scope (CO7) |
| Email notifications and automatic reminders (handoffs, stage changes, coverage changes, contacts, expiries, action items, deletion) | M2, M3, M5, M6, M7, M8, M9, M10, M11, M12, M14, M16 out of scope (S8, N9, F4, F6) |
| Actual versus contracted volume | M1, M3, M4, M6, M14 out of scope (C8) |
| Billing system link and sync, contract-to-invoice reconciliation, first-invoice trigger | M1, M3, M4, M6, M14 out of scope (F8, F9) |
| Churn signals | M1, M4, M11 out of scope (C10) |
| Automatic sanctions screening, ownership monitoring, scheduled GLEIF re-checks | M2, M12 out of scope (CO10) |
| Sales fields read-only after handoff with correction requests | M2, M3, M6, M7, M8, M15 out of scope (S9) |
| Decline or return of a Sales → Ops handoff | D2, M3 out of scope |
| User deactivation and offboarding; session expiry | M15 out of scope |
| Company SSO sign-in | M15 AC11, resolution 60 |
| Drafts in the wizard | M2 out of scope |
| Bulk coverage status change; bulk owner reassignment; temporary cover with automatic return | M5, M9 out of scope |
| Snooze and dismiss on worklists; configurable thresholds; "My action items" list | M10, M11 out of scope |
| Document upload (evidence and contract PDFs) | M4, M12, M13 out of scope |
| Note deletion, attachments, group-level timeline, history export | M10 out of scope |
| Hard delete and data retention; logging of read access and denied attempts | M16 out of scope |
| Configurable stages; custom roles; per-field permission editing; more than one admin | M6, M15 out of scope |
| Online VAT validation (VIES), GLEIF re-check of the billing LEI | M14 out of scope |
| Admin screens for SEPA list, groups in bulk, owner picker rules | M4, M5, M9 out of scope |
| Issue flow phase 2: escalation to the admin ("At risk", M24); issues created from email, Slack, a customer portal or monitoring; attachments; merging issues; phone, email or Slack alerts, on-call alerts included; sending through the Gmail API with reply threading, or Microsoft Graph; automatic first notification; customer status page and Jira sync; editing the issue team and the on-call rota; holiday calendars per country; resolution clock with targets and a pause; team leads with tiered escalation; performance reporting; regulatory columns and regime-derived deadlines in the Obligations view | Appendix B "Out of scope" blocks (M17 to M27), 19_issue_flow_utilizatori_stories.md section 8 |

#### Conflicts resolved (section 7)

1. Seed conflicts 1 to 14 are listed in 7.1.16.
2. The Intro signs in as Adrian Koh by default; 13 S0 does not name a default user, the Intro script starts as Ops.
3. Live GLEIF data adds HVB (renewal 2026-10-22) to the Compliance worklist on demo days before that date; 14 Scenario 3 does not list it. Handled in the pre-demo checklist and the E2E oracle uses a frozen fixture.
4. Partner-only entities (OCBC, Bank of Ireland) follow decision B1: each has an Active coverage row, so both are Live.
5. The seed and E2E tests fix "today" through `DEMO_CLOCK_START` so business-day and bucket assertions are deterministic; the live demo uses the real date.

### 7.6 Release cut (R1 and R2)

**Status:** confirmed by the Product Owner on 3 October 2026 (decisions B9 to B14). This section is the binding map from Appendix A to the two releases; Appendix A itself is unchanged.

#### 7.6.1 Rules of the cut

1. R1 is a thin slice: every story M1 to M16 is live at minimum depth, and the 9 problems are visible (1.7).
2. R1 holds everything the 4 short scenario versions need.
3. An R1 AC never needs an R2 AC to work. Where an AC is split, the R1 part carries its own complete behaviour (7.6.3).
4. Audit (M16 AC1, AC2), History events and server permission ACs are R1 and apply to every action as it lands. R2 actions bring their own audit entries and History events through the same service layer.
5. The full spec stays. R2 delivers every AC listed under R2 below, so R1 + R2 = Appendix A.
6. The full schema and the full seed are built in R1 (7.6.7).

Notation: "AC5 (part)" means the AC is split. The part in each release is named in 7.6.3.

#### 7.6.2 Story cut M1 to M16

| Story | R1 ACs | R2 ACs | R1 in plain words |
|---|---|---|---|
| M1 Search and single record | 1, 2, 3, 4, 5 (part), 6, 7, 8, 9 (part), 10, 11, 12, 13, 14, 15, 16, 17, 19, 20 | 5 (part), 9 (part), 18 | Search by name, alias, LEI or BIC from the top bar, filter by country and scheme, open one record with header, Overview and a Details tab |
| M2 Create with GLEIF and duplicates | 1, 2, 3, 4, 5, 7 (part), 8 (part), 9, 10, 11, 12, 14, 17, 18 (part), 19 | 6, 7 (part), 8 (part), 13, 15, 16, 18 (part) | Sales pastes an LEI, GLEIF fills the legal data and suggests the group, the duplicate panel warns and asks for a reason |
| M3 Contracted terms and Sales → Ops handoff | 1, 2, 3, 5, 6, 7, 8, 9, 10 (part), 11, 12, 13 (part), 15, 16, 17, 18 (part) | 4, 10 (part), 13 (part), 14, 18 (part) | Sales records products, terms, SLAs and the champion, then hands over to a named Onboarding Manager who confirms pickup and becomes owner |
| M4 Group, contracts, roles | 1, 2, 3, 5, 7 (part), 9 (part), 12, 13, 14, 15, 16 | 4, 6, 7 (part), 8, 9 (part), 10, 11 | The group record shows every entity with roles, contract, invoiced entity and stages; Ops links and unlinks entities, adds a role and attaches an entity contract |
| M5 Partner coverage | 1, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16 | 2, 3, 4, 5, 6, 17 | Network changes a coverage row's status with a reason; every team sees the badge, the status history and the Overview alert |
| M6 Stage per product | 1, 2, 3, 4, 7, 8 (part), 9, 10 (part), 11 (part), 12, 13, 14, 15, 16, 17, 20 | 5, 6, 8 (part), 10 (part), 11 (part), 18, 19, 21 | One 9-stage band per product line; Ops moves a line one stage forward, marks it blocked and resolves the block; lifecycle and "Billable from" follow |
| M7 Contacts with roles | 1, 2 (part), 3, 4, 5, 6 (part), 9 (part), 10, 11, 14, 15 | 2 (part), 6 (part), 7, 8, 9 (part), 12, 13 | Contacts carry a role and an owning team; the primary incident contact leads the partner header with local time and availability; the owning team adds and edits contacts (time zone and availability included) and marks them verified |
| M8 Ops → CS handoff | 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 (part), 11, 14, 15 (part), 16, 17 | 10 (part), 12, 13, 15 (part) | Ops sends a 4-section handoff to a named CSM, the CSM sees it in "To pick up" and accepts, and ownership moves to the CSM |
| M9 Owner reassignment | 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 (part), 12 | 10 (part), 11 | CS reassigns the owner with a reason; the new owner gets a Home item with a badge and acknowledges it from Home |
| M10 Shared history | 1, 2, 3, 4, 5, 6, 7, 12 | 8, 9, 10, 11 | Every team adds a note with participants and action items; the timeline merges notes and automatic events, newest first |
| M11 Worklists | 1, 2, 3 (part), 4, 5 (part), 6, 7, 8, 9, 10 (part), 11, 12, 13, 19, 20, 21, 22, 23 (part), 25 | 3 (part), 5 (part), 10 (part), 14, 15, 16, 17, 18, 23 (part), 24 | Home shows computed sections for Ops, CS and Compliance on the "Mine" scope (7.6.5) |
| M12 KYB and periodic review | 1, 2, 3, 6, 7, 8, 9, 10, 11 (part), 12 (part), 13, 14, 15, 16 | 4, 5, 11 (part), 12 (part) | Compliance records the licence with expiry and an approved evidence link and refreshes the LEI from GLEIF; all four cards and the review show their computed status |
| M13 Obligations | 1 (part), 2, 3, 4, 5, 6, 8, 9 (part), 10 (part), 12, 13, 14 | 1 (part), 7, 9 (part), 10 (part), 11 | Compliance edits the Customer agreement card; Search has an Obligations view with an incident-notice filter and sort |
| M14 Billing flag | 1 (part), 6, 7, 8, 9, 12 (part), 13, 15 | 1 (part), 2, 3, 4, 5, 10, 11, 12 (part), 14 | The "Incomplete for billing" flag is computed, shown as a header badge and named field by field on a read-only Billing tab |
| M15 Roles and ownership | 1, 2, 3, 4, 7, 8, 9, 11, 12 (part), 13 | 5, 6, 10, 12 (part), 14 | Six fixed teams, one matrix enforced on the server, "Owned by <Team>" labels, "View as", and the read-only Roles & permissions page |
| M16 Audit and soft delete | 1, 2, 3, 4, 5, 8, 9, 10, 11, 12, 13, 14, 16 | 6, 7, 15 | Every write is audited in the same transaction; Compliance and the admin read the Audit tab; the admin soft-deletes and reactivates; Reset demo data works |

#### 7.6.3 Notes on split ACs (what each part contains)

**M1**
- AC5 R1: Country and Scheme filters (multi-select, AND across types, OR inside), same-line matching rule, and the lifecycle default "every state except Inactive" applied silently. R2: Role, Stage, Partner coverage status, Lifecycle and Owner filters (including "No owner").
- AC9 R1: relevance order and alphabetical ties. R2: user sort by legal name, country, lifecycle.
- AC10 is R1 in full: deleted rows never appear, Inactive rows stay out under the default. The "Inactive" badge path becomes reachable in R2 with the Lifecycle filter.
- Typeahead in the global bar is R2 (S0). In R1, Enter opens S2 results and a row click opens the record, which still meets AC13 (type, select result, read header).

**M2**
- AC7 R1: ISSUED accepted, LAPSED amber warning with continue, PENDING_* amber with continue, RETIRED, MERGED, ANNULLED and DUPLICATE red warning that blocks Next. R2: "Use successor LEI" and continue with a reason.
- AC8 R1: pre-select the group whose parent LEI matches the GLEIF ultimate parent, tag "Suggested from GLEIF parent". R2: "Create group from GLEIF parent" (with M3 AC10 part) and the mismatch warning.
- AC18 R1: "Record created by" and "Duplicate warning acknowledged". R2: "LEI status override" (comes with AC7 R2).
- States R1: loading, LEI not found (blocks Next), GLEIF timeout with cache for demo LEIs, "GLEIF unavailable" message for LEIs outside the cache (blocks Next). R2: manual entry fallback with "Not verified with GLEIF" and the header "Retry GLEIF lookup".
- AC15 R2: in R1 leaving the wizard discards its data with no dialog. Nothing is saved either way, so AC14 holds.
- AC16 R2: Ops editing of the entity core on Details. In R1 the entity core card is read-only for every team, labelled "Owned by Ops".

**M3**
- AC10 R1: one transaction for entity, Customer role, product lines, contacts and Handoff. R2: the group created from the GLEIF parent.
- AC13 R1: owner stays Sales and the banner "Handoff to <OM> pending since <date>" shows. R2: "Change Onboarding Manager" (and edge case 3).
- AC14 R2: post-handoff edits to product lines, SLAs, special terms, initial contacts and commercial terms (incl. D3 Finance edit). R1 shows these read-only with the matrix labels, so AC15 (Finance reads them) is complete.
- AC17 R1 fires every event an R1 action produces. "Commercial terms changed" first fires in R2 with AC14.
- AC18 R1: Ops "Go-lives in the next 14 days". R2: Sales "Overdue go-lives" and the "Waiting <n> days" marker.

**M4**
- AC7 R1: Ops adds a role (Customer creates an empty Customer role; Network partner shows the Partner tab). R2: role removal, together with AC8, so data is never hidden without the confirmation.
- AC9 R1: Attach contract dialog with "New contract", scope Entity contract, invoiced entity = the entity itself. R2: the group master agreement option (AC10) and a different invoiced entity.
- The R1 Link entity dialog lists only standalone entities, so AC4 (move between groups) is never reached in R1.
- Seeded master agreements, invoiced entities and partner agreement references are displayed in R1 (AC1, AC16, Details read-only cards). Attaching a partner agreement reference (AC11) and creating a group (AC6) are R2.

**M5**
- AC7 R1 with the S4.5 rule "effective date no later than today". Scheduled status (AC17) is R2 with Add coverage.
- AC2 R2: editing the connection method. R1 displays it (part of the AC11 layout).
- AC3 to AC6 R2: Add coverage. R1 shows "No coverage recorded yet." on a newly added Partner role.

**M6**
- The R1 Change stage dialog offers N+1 only. AC5 (skip) and AC6 (back) are R2.
- AC8 R1: Resolve block with optional note and duration in History. R2: Edit block.
- AC10 R1: target date shown and "Go-live overdue by n days". R2: Edit target go-live with reason (plus M6 edge case 6).
- AC11 R1: "Billable from" set on entry to Live & hypercare and shown on band and Overview. R2: removal on a backward move (comes with AC6).
- AC9 is R1 in full: an open block survives a stage change; the dialog shows it with the "Resolve block" checkbox.

**M7**
- AC2 R1: one role per record. R2: "Copy details from <name>".
- AC4 is R1 in full (decision B12): full name, email, phone (E.164, required for Incident and Escalation), job title, status, auto Last verified, time zone and availability with their required rules. Every contact created or edited in R1 has a time zone, so the "Time zone not recorded" state never occurs.
- AC6 R1: Left contacts display in the collapsed "Former contacts (n)" section. R2: the "Mark as left" action and dialog.
- AC9 R1: the seeded Primary flag leads, else the most recently verified. R2: "Set as primary".
- AC10 is R1 in full, including local time and "Available now" / "Outside availability" from the stored time zone and availability.

**M8** (decision B11)
- AC10 R1: CSM "To pick up" row and the read-only summary with "Accept". R2: "Decline".
- AC15 R1: any Ops user sends, only the chosen CSM accepts. R2: cancel.

**M9** (decision B10)
- AC10 R1: "Acknowledge" on the Home row, badge decrements, audit entry. R2: the header banner "You were assigned as owner on ..." with its own Acknowledge.

**M10**
- AC8 R2: the filter UI. R1 applies the AC8 default set on the server (every type except "Other field changes"), so the timeline and Overview "Latest interactions" stay readable.
- AC9, AC10 R2: in R1 action items save as Open and display read-only.
- AC11 R2: in R1 a saved note is read-only for everyone.

**M11**
- AC3 R1: "Mine" for Ops and CS, "All institutions" for Compliance. R2: the "Mine / My team" toggle, the Sales "created by" scope, resolution 10 and edge case 6.
- AC5 R1: "To pick up" and "Awaiting acceptance". R2: "Handoff declined" and the "Waiting <n> days" pin after 2 business days.
- AC10 R1: CS "To pick up". R2: the 2-business-day highlight.
- AC23 R1: "View as" opens Home on "Mine" with that team's sections. R2: the toggle.

**M12** (decision B10)
- AC1 R1 renders all four cards and the periodic review card for every team.
- AC11 R1: review status, last and next date displayed. R2: "Schedule review" and editing.
- AC12 R1: Overdue computed automatically (feeds the Compliance worklist and the Overview alert). R2: In progress with the "Past due" marker and the Completed flow.
- AC4, AC5 R2: editing Ownership and Sanctions. R1 displays the seeded values, chips and evidence links read-only.

**M13**
- AC1 R1: Customer agreement card. R2: Partner agreement card (Compliance tab, and the read-only summary on the Partner tab).
- AC9 R1: one row per Customer agreement card. R2: Partner rows (two rows for dual-role entities).
- AC10 R1: Incident notice min and max; AND with the R1 Search filters; the scheme filter matches the card's scheme status (captured and other than "Not applicable"); country matches the product line country (decision B7). R2: Subprocessor notice min and max, and the Partner coverage status filter on Partner rows.
- AC12 R1 keeps the default sort Subprocessor notice descending and both sortable columns.

**M14**
- AC1 R1: the fields render read-only, with "No billing profile yet" and the full missing list when absent. R2: Create and Edit billing profile (with AC2 to AC5, AC10, AC14).
- AC7 R1 re-checks format through the VAT and LEI validators (built in R1 for the flag), so the AC7 rule is complete without the R2 edit form.
- AC12 R1: read-only with "Owned by Finance" for every team. R2: Finance Edit button.
- In R1 the flag can clear only through the contract reference (Ops, Attach contract). State this in Q&A if asked.

**M15** (decision B10)
- AC12 R1: Admin menu for the admin with Deleted records, Roles & permissions and Reset demo data; Compliance sees Roles & permissions only. R2: the Users & roles entry (with AC5, AC6, AC14).
- AC13 is R1 in full: the whole Roles & permissions page. Team change history stays R2 with AC14.
- AC10 R2: rights changing mid-session only happens through a team change (AC5, R2). The generic 403 handling (toast and read-only re-render) ships with AC5.

**M16**
- AC13 R1: reactivation is blocked when another active entity holds the same LEI, with the message "<entity> already uses this LEI. Reactivation with a reused LEI comes in a later release." R2 replaces this with the AC15 flow. This keeps the seeded "Lloyds Bank (legacy import)" from producing two active Lloyds records.

#### 7.6.4 Scenario coverage

**All four short versions run on R1.** What each one uses:

| Scenario (short) | R1 features it needs |
|---|---|
| 1 New customer | Wizard steps 1 to 4 with GLEIF (cache fallback), group suggestion, duplicate panel and reason; submit transaction; pending banner; Ops "To pick up" and Confirm pickup; forward stage move; group record count; Revolut Ltd UK CoP / GB moved from Live & hypercare to Ramp-up (decision B14); Ops → CS handoff form and send on Revolut |
| 2 Partner incident | Search (Enter + row click), partner header with primary incident contact, local time and availability; Change status on coverage; Country + Scheme filters with "Customer product" and "Partner coverage" chips; URL state across "View as"; Obligations view with Incident notice sort |
| 3 Audit | Compliance worklist incl. LEI lapsed and periodic review items; Adyen's four KYB cards and review card; Licence re-verification with evidence link validation; Audit tab newest first; Roles & permissions page; soft delete, Deleted records, Reactivate |
| 4 CSM day | CS Home with "Ownership assigned to you" and renewals; inline Acknowledge; Details Customer role card; Overview with stages, key people and the periodic review alert; Add note with action items; Reassign owner on Adyen |

Short-version notes for the presenter:
- **Scenario 1 short, step 4:** Revolut Ltd starts at Live & hypercare, and "Hand over to Customer Success" is disabled until a product reaches Ramp-up (M8 AC1). The short script moves UK CoP / GB to Ramp-up first (decision B14), then opens the handoff. This is the scenario's stage-move moment.
- **Scenario 2 short, step 4:** the full script sets Role = Customer (R2 filter). In R1 the Obligations view holds only Customer rows, so the same 4 rows appear with the same order and count; the presenter skips that click.
- **Scenario 4 short, step 4:** open Adyen from Search (the "My team" route is R2).

**Full versions: steps that need R2** (step numbers from the 7.3.2 Playwright specs)

| Scenario | Full step | R2 feature needed |
|---|---|---|
| E2E-1 | 1 | Sales Home sections "Overdue go-lives" and "Champion left" (M11 AC17, AC18) |
| E2E-1 | 8 | Finance "Edit" control on commercial terms (M3 AC14, D3). The rest of step 8 (Billing banner, "Owned by Ops" contract reference, SLA read-only "Owned by Sales") runs on R1 |
| E2E-1 | all others (2 to 7, 9 to 13) | none |
| chain.spec | Accept Revolut | none (Accept is R1) |
| E2E-2 | 1 | Typeahead pick (S0). The R1 equivalent uses Enter and a result row |
| E2E-2 | 4 | "Network and structure" event-type filter (M10 AC8). The event text itself is R1 |
| E2E-2 | 6 | Role filter = Customer (M1 AC5 part). Result is identical on R1 because Partner rows are R2 |
| E2E-2 | Q&A: partner agreements with Degraded coverage | Partner rows and coverage status filter in the Obligations view (M13 AC9, AC10 parts) |
| E2E-2 | 2, 3, 5, 7, 8 | none |
| E2E-3 | 3 | "Partner agreement 5 of 8 captured" (M13 AC1 part). Licence re-verification and "8 of 8" on the Customer card run on R1 |
| E2E-3 | 4 | Audit Field filter "Expiry date" and the count line (M16 AC6). R1 shows the new entry as the top row |
| E2E-3 | 9 | Users & roles Change history (M15 AC14) |
| E2E-3 | Q&A: reactivate with reused LEI | M16 AC15 |
| E2E-3 | 1, 2, 5, 6, 7, 8 | none |
| E2E-4 | 5 | "Open action items only" toggle and the "Overdue" label (M10 AC9) |
| E2E-4 | 7 | "My team" toggle on Home (M11 AC3 part). Reassign itself is R1 |
| E2E-4 | 1, 2, 3, 4, 6, 8 | none |

#### 7.6.5 Worklist (M11) sections

| Team | Section | Release | Why |
|---|---|---|---|
| Ops | To pick up | R1 | Scenario 1 short (pickup) |
| Ops | Awaiting acceptance | R1 | Sender side of the R1 Ops → CS handoff; same query as CS "To pick up" |
| Ops | Handoff declined | R2 | Needs Decline (M8 AC12) |
| Ops | Blocked | R1 | Problem 5 |
| Ops | Go-lives in the next 14 days | R1 | Problem 5 |
| Ops | Too long in current stage | R1 | Problem 5; entry point to the Revolut stage move |
| Ops | Required fields empty | R1 | Problem 3; every wizard-created customer lands here |
| Ops, CS, Sales | Ownership assigned to you | R1 | Scenario 4 short; one shared section component |
| CS | To pick up | R1 | Needed for Accept (decision B11) |
| CS | Renewals in the next 120 days | R1 | Scenario 4 short |
| Compliance | KYB and review expiries (licence, LEI, periodic review; 4 buckets) | R1 | Scenario 3 short |
| Network | Partner contacts not verified for 90+ days | R2 | All sections for every team arrive in R2 |
| Finance | Incomplete billing profiles | R2 | As above; the flag and badge are R1 |
| Finance | Billing contacts not verified for 6+ months | R2 | As above |
| Sales | Awaiting pickup | R2 | As above |
| Sales | Overdue go-lives | R2 | As above |
| Sales | Champion left | R2 | Needs M7 AC7 |

Cross-cutting worklist rules in R1: computed on every load, Overdue-first sort, read-only rows with "Open" deep links, inline Acknowledge as the one action, refresh after action, deleted and Inactive excluded, empty and per-section error states. R2 adds the "My team" scope, the "Waiting <n> days" pin and highlight (business days), and the Network, Finance and Sales sections. In R1, Home for Network, Finance and Sales shows "Your worklist is clear" (Sales also has the "New customer" button), plus "Ownership assigned to you" when it has items.

#### 7.6.6 Screens, tabs and dialogs

| Screen | R1 | R2 additions |
|---|---|---|
| S0 App shell | Demo strip, "View as" switcher, top bar with global search (Enter goes to S2), user menu, Admin menu (Deleted records, Roles & permissions, Reset demo data), toasts, access and not-found pages | Search typeahead; Admin menu entry "Users & roles" |
| S1 Home | R1 sections (7.6.5), "Mine" scope, Home badge, summary strip, states | "Mine / My team" toggle; R2 sections; waiting pins |
| S2 Search | Query, Country and Scheme filters, partner chips, result rows, count, 25-row paging, URL state, relevance sort; Obligations view with Customer rows, Incident notice filter, both sortable columns | Role, Stage, Coverage status, Lifecycle, Owner filters; user sorts; contract ID matching; Obligations Partner rows, Subprocessor filter, "Only rows where this is not captured" |
| S3 New customer wizard | Steps 1 to 4, GLEIF lookup with cache, LEI status warnings, group suggestion, duplicate panel, submit | Discard dialog; country override; invalid-status override and successor; create group from GLEIF parent; "Add Customer role to this existing entity"; "Contracted entities not yet in the portal"; manual entry when GLEIF is unavailable |
| S4.0 Entity header | All attributes, partner incident block, owner block, "Reassign owner", Sales → Ops and Ops → CS pending banners, billing badge, "Hand over to Customer Success", "More" → "Delete record" (admin), deleted-record banner and page | Assignment banner with Acknowledge; "Change Onboarding Manager"; "Retry GLEIF lookup" |
| S4.1 Overview | Complete (read-only) | none |
| S4.9 Details | All cards render. Edits: Roles (add only), Attach contract (new entity contract), Edit renewal date (CS) | Entity core edit; role removal; master agreement option; Attach partner agreement; Mark as Inactive; commercial terms, SLA and special terms edit |
| S4.2 Products & onboarding | Bands, Change stage (N+1), Mark as blocked, Resolve block | Skip and back; Edit block; Edit target go-live; Add product line; Edit product line; Mark as cancelled |
| S4.3 Contacts | Role groups, context sections, header-filtered view, Former contacts (collapsed), Add contact and Edit contact drawer including time zone and availability fields with their rules (B12), Mark as verified | Mark as left; Set as primary; duplicate warning; "Copy details from" |
| S4.4 History | Timeline (default filter applied server-side), note and event cards, Add note drawer, Load more | Filter bar; "Open action items only"; Edit note (24 h); action item toggle |
| S4.5 Partner | Coverage table by scheme, status history expand, counts line, Change status dialog, connection method card read-only, retired collapse | Add coverage; Edit connection method; Scheduled status; Partner agreement summary card |
| S4.6 Compliance | Four KYB cards (Licence and LEI editable: Record verification, Refresh from GLEIF), periodic review card read-only, Customer agreement card with Edit | Ownership and Sanctions edit; Schedule and complete review; Partner agreement card; obligation expiry badge |
| S4.7 Billing | Read-only: banner, profile card, contract reference card, "Billed through", billing contacts card, partner-only note | Create and Edit billing profile |
| S4.8 Audit | List newest first, 50 per page with Load more, deleted-record admin view | Filters (Field, User, Date range) and count line; "Expand" for long values |
| S5 Group record | Header, five exposure tiles, contracts panel, member table, Link entity (standalone entities only), Unlink | Move to another group; Create and Edit group; admin line "<n> deleted entity" |
| S6 Handoff | View A (Sales → Ops summary, Confirm pickup); View B (Ops → CS form, send); View C (summary, Accept) | Change recipient; Decline; Cancel handoff; resend with prefill |
| S7.1 Users & roles | none | Whole page: table, Change team, Add user, Change history |
| S7.2 Deleted records | Complete except the reused-LEI flow | Reactivate with reused LEI (M16 AC15) |
| S7.3 Roles & permissions | Complete | none |

**Dialogs and drawers**

| R1 | R2 |
|---|---|
| Reassign owner; Delete record; Reactivate (plain confirm, blocked on LEI conflict); Reset demo data; Change stage (N+1); Mark as blocked; Resolve block; Edit roles (add); Attach contract (new entity contract); Edit renewal date; Add contact / Edit contact drawer (with time zone and availability); Add note drawer; Change status (coverage); Record verification (Licence); Edit obligations (Customer agreement); Link entity; Unlink; Confirm pickup (S6 View A); Ops → CS form (S6 View B); Accept (S6 View C) | Discard new customer; Change Onboarding Manager; Decline handoff; Cancel handoff; Edit block; Edit target go-live; Add product line; Edit product line; Mark as cancelled; Remove role; Attach partner agreement; Mark as Inactive; Edit entity core; Edit commercial terms; Edit handoff summary and SLAs; Mark as left; Set as primary; Edit note; Add coverage; Edit connection method; Record verification (Ownership, Sanctions); Schedule / complete review; Edit obligations (Partner agreement); Create / Edit billing profile; Move entity; Create / Edit group; Reactivate with reused LEI; Change team; Add user |

#### 7.6.7 Data model and seed

**Schema: full in R1.** Milestone 2 creates every model in 3.2.2 (all of 3.2.1: Group, Entity, EntityAlias, EntityBic, CustomerRole, VolumeTier, PartnerRole, PartnerCoverage, CoverageStatusChange, Contract, ContractedProduct, StageEvent, Contact, KybCheck, PeriodicReview, ObligationCard, BillingProfile, Handoff, Note, NoteParticipant, ActionItem, HistoryEvent, OwnerAssignment, AuditEntry, User, UserTeamChange), every enum (3.3), the hand-written SQL (3.2.3: `pg_trgm`, audit grants, the two database roles) and the lifecycle derived column. R2 adds routes, services and screens only, with no migration. Fields that only R2 writes (for example `cancelledAt`, scheduled coverage dates, note `editedAt`, block edit fields, handoff decline and cancel fields) exist from R1 and stay null.

**Seed: full in R1.** All of 7.1 loads in R1 through `seed()`, `db:reset` and Reset demo data, with every audit entry and History event. The R1 screens read most of it. Rows that only R2 screens or R2 rules consume:

| Seed rows | Used by (R2) | Visible in R1 as |
|---|---|---|
| Nora Lee team change and the 12 "User added" audit entries (7.1.1) | Users & roles Change history | nothing |
| Partner-context ObligationCards: lloyds, totta, adyen, ingdiba, ocbc, boi (7.1.12) | Partner agreement card, Partner tab summary, Obligations Partner rows | nothing |
| H11 Totta Ops → CS Declined (7.1.9) | Ops "Handoff declined" | History event on Totta |
| H14 scbPt Sales → Ops Sent to Kevin Lim | Ops "My team" To pick up with "Waiting 3 days" | pending banner on scbPt |
| Oliver Bennett Left on santanderUk (7.1.8) | Sales "Champion left", Overview "No active champion" alert (M7 AC7) | Former contacts section, History event |
| P12 Zopa target `today-6` | Sales "Overdue go-lives" | band "Go-live overdue by 6 days" |
| Eva Smit (never verified), Marta Kovacs (200 days), João Ferreira (120 days) | Network worklist | contact rows "Verified n days ago" |
| Sofia Ribeiro billing contact (`today-204`) | Finance billing contacts worklist | Billing contacts card |
| Billing profiles of zopa, hvb, revolut as a Finance list | Finance "Incomplete billing profiles" | header badge and Billing banner per entity |
| Zopa "No contract attached" under owner Kevin Lim; Adyen renewal under Leo Martin | Ops and CS "My team" items | Overview and Details per entity |
| MPS Payment note open action item past due | "Open action items only" toggle and "Overdue" label | note card with the item as Open |
| rbi Inactive | Lifecycle filter, Inactive badge in search | record by URL, History event |
| ocbc "No owner" | Owner filter "No owner" | header "No owner" with "Set owner" for CS |
| IPE-MSA-2026-014 as a search term | Contract ID search (M1 AC18) | contracts panel on the group record |
| Monzo subprocessor notice 0 | Subprocessor filter edge case | "No advance notice required" on the card |
| hvb obligation expiry `today-10` | Obligation "Expired" badge (M13 AC7) | expiry date on the card |
| lloydsLegacy sharing the Lloyds LEI | Reactivation with reused LEI (M16 AC15) | Deleted records row; wizard duplicate warning for deleted LEI; R1 blocks its reactivation |

#### 7.6.8 Tests split

- **Unit tests (Vitest):** the Release column of the 7.3.1 table names the R1 cases and the R2 cases per file. The R1 cases are part of the gate. `validators/contact.test.ts` is R1 in full because time zone and availability capture is R1 (decision B12).
- **Playwright:** R1 runs four short specs; R2 adds the four full specs and `chain.spec.ts`. The step lists are in the release split table at the top of 7.3.2.

#### 7.6.9 Dependency guards (binding R1 rules, decision B13)

Each guard keeps an R1 AC working with its R2 partner absent. The R2 milestone in brackets lifts it.
1. Edit roles is add-only in R1. Role removal waits for M4 AC8, so no data gets hidden without the confirmation (milestone 10).
2. Link entity lists standalone entities only, so the move flow (M4 AC4) is never needed (milestone 10).
3. Change stage offers N+1 only, so "Billable from" removal (M6 AC11 part) is never needed (milestone 10).
4. Coverage status changes take an effective date no later than today, so Scheduled status (M5 AC17) is never needed (milestone 10).
5. Reactivation blocks when another active entity holds the LEI, so the seeded legacy Lloyds record never needs M16 AC15 (milestone 9).
6. History applies the M10 AC8 default set on the server, so "Other field changes" stays out of the timeline and "Latest interactions" without the filter UI (milestone 9).
7. The wizard blocks Next on invalid LEI statuses and on "GLEIF unavailable" for non-cached LEIs, so the R2 override and manual-entry paths are never needed. Demo LEIs answer from the cache, which meets definition-of-done item 7 for the demo (milestone 11).
8. Contacts created or edited in R1 capture time zone and availability with the M7 AC4 rules (decision B12), so every contact shows local time and availability and the "Time zone not recorded" state never occurs. This guard stays in R2.
9. Ops "Required fields empty" lists only fields R1 users can fill: contacts (Add contact), contract (Attach contract) and the group decision (Link entity). LEI, type, country and target dates are always present on wizard-created records and in the seed (milestone 10 widens it when the R2 edits land).

#### 7.6.10 R1 share of the full build effort

**Estimate: about 68% (range 60 to 70%).**

| Build plan milestone (full build, before the split) | Weight of full build | R1 share of milestone | R1 effort |
|---|---|---|---|
| Scaffold, tokens, shell | 5% | 95% | 5 |
| Data model, full seed, demo mode, GLEIF client | 12% | 100% | 12 |
| Read paths (search, record, all tabs, group) | 15% | 80% | 12 |
| Permissions, audit, admin | 10% | 75% | 7.5 |
| Edits per tab (incl. contact time zone and availability capture, B12) | 20% | 45% | 9 |
| Wizard, GLEIF, duplicates | 12% | 75% | 9 |
| Handoffs and worklists | 14% | 65% | 9 |
| Polish and demo readiness | 12% | 40% | 5 |
| **Total** | 100% | | **about 68** |

Cross-check by AC count: about 194 of 267 ACs fall in R1 (split ACs counted as half), 73%. The effort share sits lower because R2 holds most of the edit dialogs, the business-day and scope logic, and the remaining states and edge cases, which cost more per AC than the read paths.

The R1 share is high for a thin slice because the foundation is shared and indivisible: full schema, full seed with audit and History rows, the permission matrix, the audit service, GLEIF with cache, and the duplicate check. If R1 must shrink before the gate, the PO decides. The two cheapest candidates that keep every short scenario working are the contact Add and Edit drawer (about 4% with B12) and the Customer agreement card Edit (about 2%).

#### 7.6.11 PO confirmations (3 October 2026)

| Open point in the cut | Confirmation | Decision |
|---|---|---|
| Acknowledge on the Home row (problem 4) | R1. Header banner stays R2 | B10 |
| Roles & permissions page (problem 9) | Whole page R1. Team change history stays R2 | B10 |
| Time zone and availability shown (problem 6) | R1 display in header and contact rows | B10 |
| Ownership, Sanctions and periodic review (problem 7) | Shown read-only in R1, review Overdue computed. Editing stays R2 | B10 |
| Ops → CS handoff | Send and Accept R1; Decline and Cancel R2 | B11 |
| Contact time zone capture | Moves into R1 together with availability; no "Time zone not recorded" gap | B12 |
| Dependency guards 1 to 9 | Kept as binding R1 rules | B13 |
| Scenario 1 short | Includes moving Revolut Ltd UK CoP / GB to Ramp-up before the handoff | B14 |

#### 7.6.12 Story cut M17 to M27 (issue flow, decision B15)

**Status:** release split from Appendix B ("Release split summary"), 5 October 2026. The rules of 7.6.1 apply: every R1 part works without its R2 partner, audit and History come with every action, and R1 + R2 = Appendix B. The issue flow is the main process, so its R1 part holds everything the demo shows.

| Story | R1 ACs | R2 ACs | R1 milestone | R1 in plain words |
|---|---|---|---|---|
| M17 Report an issue | 1 to 13 | none | 6B | Any team reports on the entity or a group, sees open similar issues, adds to one, and sees the proposed severity with its caps |
| M18 Automatic triage | 1 to 11 | 12 | 6A (1-8, 11), 6B (9), 6C (10) | Routing by type, issue team, business hours and on-call; the reporter sees owner, communicator and deadline and follows the issue |
| M19 Severity and clocks | 1 to 9, 12 to 15, 17 to 20 | 10, 11, 16 | 6A (1-9, 12, 14, 15, 19, 20), 6B (13, 17, 18) | Acknowledge and notification clocks from severity, stage and contract; the owner changes severity or type with a reason and the clocks recalculate |
| M20 Issues worklist | 1 to 13 | 14 | 6C | "Issues" first on Home for every team with Contributing and Reported by me |
| M21 Owner actions | 1 to 12 | 13, 14 | 6B | Acknowledge, status, resolve with root cause, contributors, notes, reassign |
| M22 Communication | 1 to 12, 18, 19 | 13 to 17, 20 | 6B | Incident contact, prefilled message with "Open in Gmail", notification log, close, on-call communicator at night with the hand-over |
| M23 Partner issue | 1 to 17 | none | 6C | Degraded proposal, affected customers, linked issues, cascade resolution |
| M24 Escalation | none (phase 2) | none (phase 2) | none | Not built (decision B21) |
| M25 Compliance flag | 1 to 8, 11 | 9, 10 | 6C | Flag on Sev-1 at regulated customers and on possible breaches; three-way assessment within 1 hour |
| M26 Regulatory fields | 1 to 8, 10 | 9 | 6A | Regime, regulator's deadline and facts hours on the Customer agreement card; "Post-incident report due (days)" seeded, rendered in R2 |
| M27 Root cause report task | none | 1 to 7 | 12A | Not in R1 |

Notes on the cut:
- The schema and seed of the issue flow are complete from 6A (decision B37): R2 fields such as `absentUntil`, `factsDueAt`, `postIncidentReportDays` and `RootCauseReportTask` exist and stay unused until 12A.
- The R2 Home steps ("Send update", "Send facts pack", "Notify data breach", "Remind customer", "Send root cause report") and the R2 log types ("Facts pack sent", "Breach notification") appear only from 12A; in R1 the record dialog offers "First notification" and "Update".
- In R1 a Closed issue stays closed: "Reopen" and "Report a new issue linked to <ID>" are R2 (M22 AC15, AC16). Nothing closes automatically in R1.
- The M11 R1 and R2 sections of 7.6.5 are unchanged; the "Issues" section is R1 for every team, so Network, Finance and Sales get it in R1 above "Your worklist is clear".

#### 7.6.13 Issue screens and tests by release

| Screen or element | R1 | R2 additions |
|---|---|---|
| Entity Issues tab (S4.10) | Complete | none |
| Report issue panel (S8.1) | Complete, entity and group | Prefill from "Report a new issue linked to <ID>" |
| Issue page (S8) | Header, banners, Clocks panel (acknowledge, notification, Compliance assessment), Communication section, Resolution, People, Customer obligations, Compliance block, partner panels, Related issues, Notes | Update, facts and breach clock rows; "Reopen", "Take over communication"; Root cause report block; "Remind customer" line; "Closed automatically" label |
| Home "Issues" section | All groups, R1 steps, badge, refresh, section-level "Mine / My team" for Ops and CS | R2 steps (4.6.9); the page-wide M11 toggle replaces the section control |
| Details "Issue team" block | Read-only | Backup names (M18 AC12) |
| Compliance "Regulatory" block | Regime, regime name, regulator's deadline, facts hours; counter "of 3" | "Post-incident report due (days)"; counter "of 4" |
| Dialogs | 6.13.5 R1 column | 6.13.5 R2 column |
| Unit tests | `issues.test.ts` R1 group; issue additions of `seed.test.ts` | `issues.test.ts` R2 group |
| Playwright | E2E-5 short (steps 1, 2, 4 to 12) | E2E-5 full (adds steps 3, 13, 14) |



---

## Appendix A. Acceptance criteria (M1 to M16)

### A.0 Source: acceptance criteria document

**Status:** approved by the Product Owner on 2 October 2026, with the later decisions in section 1.6.
**Scope:** M1 to M16 (section 1.4). Each story has: Story, Screens, Acceptance criteria, States (empty, loading, error, read-only), Edge cases, Out of scope.
**Use:** the acceptance criteria for this build, embedded in full. The UI and these criteria are in English.

### A. Shared conventions (apply to every story)

**Product name:** Customer Hub. A "customer" is a bank or fintech that buys Corvane services. A "partner" is a network institution that answers verifications. One legal entity can hold both roles.

**The 9 onboarding stages, exact names and order:**
1. Contract signed
2. Kickoff
3. Sandbox & technical integration
4. Testing & certification
5. UAT
6. Go-live approval
7. Live & hypercare
8. Ramp-up
9. BAU

**Fixed UI names:**
- Wizard: "New customer" (4 steps). Only Sales opens it.
- Worklist section for incoming handoffs: "To pick up". Ops sees Sales to Ops handoffs there, the chosen CSM sees Ops to CS handoffs there.
- Sender side: "Awaiting acceptance" and "Handoff declined".
- Read-only label on fields owned by another team: "Owned by <Team>". The six labels are exactly: "Owned by Sales", "Owned by Ops", "Owned by Customer Success", "Owned by Network", "Owned by Compliance", "Owned by Finance". Two combined labels also exist: "Owned by Sales and Customer Success", always used on Champion and Decision maker contacts in the Customer context (M7 AC3), and "Owned by Sales and Finance", used on the commercial terms (D3, M15 AC3).
- Entity record tab: "Details", second after Overview. It holds the entity core, the Customer role card, the Partner role card with the partner agreement reference, the roles and the lifecycle state (M1 AC20). Overview stays read-only.
- Admin page: "Roles & permissions", a read-only view of the ownership matrix for Compliance and the admin (M15 AC13).

**Dates and time:** "today" is the current date in Europe/Bucharest. Worklist comparisons are date-only. Display format: 02 Oct 2026. "Business days" means Monday to Friday, with no holiday calendar in the MVP. Every seed date is stored as an offset from the demo day, so the examples stay true on any demo date.

**Evidence and contract links:** must start with https:// and point to an approved host. Demo host: docs.corvane-internal.example.

**Permissions:** the ownership matrix in M15 AC3 is the single source of truth. The server enforces it and returns 403 on any write outside it. The UI hides edit controls for read-only users.

**Audit:** every write creates an audit entry (object, field, old value, new value, user, team, timestamp) and a History event where the story says so (M10, M16).

**Demo institutions used in the examples (real, verified in GLEIF on 2 October 2026, reused in the seed data):**

| Institution (display name) | Type | LEI | Country | Roles in the demo | Notes |
|---|---|---|---|---|---|
| Banco Santander S.A. | Group parent | 5493006QMFDDMYWIAM13 | ES | none (group only) | Parent of the group "Santander". The group has 4 seeded entities plus 1 created in the demo |
| Santander UK plc | Bank | PTCQB104N23FMNK2RZ28 | GB | Customer | BIC ABBYGB2LXXX. Invoiced through Banco Santander Totta, S.A. under the group master agreement |
| Banco Santander Totta, S.A. | Bank | 549300URJH9VSI58CS32 | PT | Customer, Partner | Invoiced entity under the group master agreement. BIC TOTAPTPLXXX |
| Santander Consumer Bank S.p.A. | Bank | 549300O0YQXDOJB36Y73 | IT | Customer | Own local contract. Direct parent Open Bank S.A., ultimate parent Banco Santander S.A. The group link uses the ultimate parent |
| Banco Santander Consumer Portugal S.A. | Bank | 549300Z5VU00GHU3B005 | PT | Customer | LEI status LAPSED in GLEIF, entity active (lapsed LEI example) |
| Santander Consumer Bank GmbH | Bank | 5299000I7Y60A8273788 | AT | Customer | Created in the demo (scenario 1), absent from the seed. GLEIF parent suggests the Santander group. Its name differs from the Italian sister only by legal form, so the duplicate warning fires |
| Lloyds Bank plc | Bank | H7FNTJ4851HG0EXQ1Z70 | GB | Customer, Partner | Main example for an entity with both roles. Previous name "Lloyds TSB Bank plc" works as an alias |
| Banca Monte dei Paschi di Siena S.p.A. | Bank | J4CP7MHCXR8DAQMKIL78 | IT | Customer | Alias "MPS" |
| Zopa Bank Limited | Fintech | 213800QW7QJVVCL9RZ56 | GB | Customer | Alias "Zopa Financial Services" (previous name, search example) |
| UniCredit Bank GmbH | Bank | 2ZCNRR8UK83OBTEK2170 | DE | Customer | Alias "HVB". Parent: UniCredit S.p.A. (549300TRUWO2CD2G5692) |
| Adyen N.V. | PSP | 724500973ODKK3IFQ447 | NL | Customer, Partner | Bank licensed by De Nederlandsche Bank. Demo licence number DNB-BL-0412 |
| Revolut Ltd | Fintech | 213800MQORWPL582SW82 | GB | Customer | Several products at different stages |
| Monzo Bank Ltd | Fintech | 213800PLUYXGZ8LU7T61 | GB | Customer | Soft delete and reactivation example |

Institutions publicly announced as Corvane customers or partners are excluded. Contracts, stages, incidents, KYB results, obligations and contacts are fictional. Search example: "Financial Services" matches the legal name of Adyen N.V. and the alias of Zopa Bank Limited.

**GLEIF in the demo:** the wizard calls the live GLEIF API. When GLEIF is unreachable, the portal answers from a cached copy of the GLEIF records for the demo LEIs, and only for LEIs outside that cache does the "GLEIF unavailable" state apply (M2).

**Seeded demo users ("View as" switcher, M15 AC11):**

| Team | Primary demo user | Other seeded users used in examples |
|---|---|---|
| Sales | Tom Hadley | Michael Reed |
| Ops / Onboarding | Adrian Koh (also the only admin) | Kevin Lim (second Onboarding Manager in the picker) |
| Customer Success | Emma Wilson | Leo Martin, Sophie Mitchell, Ethan Brooks |
| Network | Lukas Brenner | Nora Lee |
| Compliance | Mei Chen | |
| Finance | Rachel Wong | |

External customer and partner contacts in examples (Marta Kovacs, Paul Grant, James Holloway, Priya Nair) are contact records and never portal users. Ethan Brooks is in Customer Success and Kevin Lim is in Ops. The seed has no inactive users: edge cases about deactivated users are rules for later builds.

### A. Reconciliation applied during consolidation

The 16 stories were written by 4 agents in parallel. These differences were aligned:
- Stage names unified to the 9 names above.
- Handoff worklist names unified to "To pick up".
- "Client" replaced with "Customer" everywhere, including "Customer role" and the "New customer" wizard.
- Demo user names and demo institutions unified to the tables above. External contacts renamed where they collided with portal users.
- Target go-live date: it belongs to the contracted product line. Sales and Ops both edit it, with a reason logged on every change (M6 AC10). The M15 matrix now says the same.
- A cross-story QA review fixed 34 further inconsistencies (permissions, worklist names and thresholds, handoff statuses, labels, date format).
- Screen-spec review (2 October 2026): PO decisions P1-P4 and 61 PM resolutions applied.

### A. Decisions approved by the Product Owner (2 October 2026)

| # | Topic | Decision |
|---|---|---|
| D1 | Contract reference | Ops owns it on the Customer role (M4 AC9). The Billing tab shows it read-only, and the "Incomplete for billing" flag still checks it (M14) |
| D2 | Decline of the Sales → Ops handoff | Sales → Ops has Confirm only. Decline stays in phase 2. Ops → CS keeps Accept and Decline (M8) |
| D3 | Commercial terms editors | Sales and Finance both edit them. Every change is audited (M15 AC3) |

The later decisions P2 to P4 and B1 to B5 are in section 1.6 and apply to this appendix as well.

---

### A.M1: Find an institution and open its single record

**Story (EN):** As a user from any of the 6 teams, I want to search for an institution by name, alias, LEI, BIC, country or scheme and open a single record showing its legal entities, roles (customer, partner), products and the stage of each, key people, current owner and latest interactions, so that I work from a single source and the customer gets the same answer from everyone at Corvane.

**Screens:** Global search bar (shown on every screen), Search and results (screen 2), Entity record header (screen 4), Overview tab of the entity record. Links go to the Group record (screen 5) and to the other entity tabs.

**Acceptance criteria:**

- **AC1 Global search bar.** Given a logged-in user from any team (Sales, Ops, CS, Network, Compliance, Finance), when they open any portal screen, then the global search bar shows in the top navigation and takes free text.
- **AC2 Name and alias matching.** Given the entity "Banca Monte dei Paschi di Siena S.p.A." has the alias "MPS", when the user types "paschi", "PASCHI" or "mps", then the entity appears in the results. Given the user types "comerciala", then "UniCredit Bank GmbH" appears. Matching ignores case and diacritics, matches partial words from 2 characters onward, and checks both legal names and aliases. The results row shows which alias matched, for example "Matched alias: MPS".
- **AC3 LEI matching.** Given the user enters a full 20-character LEI, for example "H7FNTJ4851HG0EXQ1Z70", when they search, then the one entity with that LEI (Lloyds Bank plc) is shown first. A partial LEI of at least 4 characters returns entities whose LEI starts with that string. LEI matching ignores case.
- **AC4 BIC matching.** Given Santander UK plc has the BIC "ABBYGB2LXXX", when the user searches "ABBYGB2L" (BIC8) or "ABBYGB2LXXX" (BIC11), then the entity appears. A BIC8 search returns every entity holding any BIC11 that starts with that BIC8.
- **AC5 Filters.** Given a results list, the user can filter it by: country (ISO 3166-1 alpha-2, multi-select), scheme (EU VoP, UK CoP, Global validation, multi-select), role (Customer, Network partner, Both), onboarding stage (the 9 stages: Contract signed, Kickoff, Sandbox & technical integration, Testing & certification, UAT, Go-live approval, Live & hypercare, Ramp-up, BAU), partner coverage status (Onboarding, Active, Degraded, Suspended, Retired, see M5 AC16), lifecycle state (Onboarding, Live, BAU, Inactive) and current owner (any portal user, plus "No owner"). Filters combine with AND across types and with OR inside one type. Further rules:
  - The role filter "Customer" includes entities that also hold the Partner role, and "Network partner" includes entities that also hold the Customer role. "Both" returns only entities with both roles.
  - Stage, country and scheme filters must match on the same product line or on the same coverage row. An entity with EU VoP in IT and UK CoP in GB does not match country = IT with scheme = UK CoP.
  - The lifecycle state filter defaults to every state except Inactive.
- **AC6 Country and scheme filter for partners.** Given the user filters by country = GB and scheme = UK CoP, then the results include customer entities with a UK CoP product in GB and partner entities with UK CoP coverage in GB. Each row labels the reason with a chip: "Customer product" or "Partner coverage". An entity with both roles that matches on both shows one row with both chips, for example Lloyds Bank plc. In the MVP, this filter is how Network answers "which customers depend on this partner".
- **AC7 Search without text.** Given the search box is empty, when the user applies only filters, then the results list every entity that matches the filters. This supports the Network "all partners in country X for scheme Y" query.
- **AC8 Results row content.** Each result row shows: legal name, matched alias (if any), type (Bank, Fintech, PSP), country, LEI, LEI status badge, roles, group name, current owner (name and team) and lifecycle state (Onboarding, Live, BAU, Inactive). The group name links to the Group record (screen 5).
- **AC9 Sorting.** Results sort by relevance in this order: exact LEI or BIC match, exact name or alias match, partial match. Ties sort alphabetically by legal name. The user can also sort by legal name, country or lifecycle state.
- **AC10 Deleted and inactive records.** Soft-deleted entities never appear in search results for any team. Entities with lifecycle state Inactive appear when the lifecycle state filter includes Inactive (AC5), with an "Inactive" badge.
- **AC11 Open record.** When the user clicks a result, then the entity record opens on the Overview tab, and the URL identifies the entity so the link can be shared with a colleague.
- **AC12 Header content.** The entity record header shows: legal name, LEI with LEI status badge, type, country, group (linked to the Group record), roles, current owner (name, team) and lifecycle state.
- **AC13 Incident contact in the header for partners.** Given the entity has the Network partner role, then the header also shows the incident contact: name, phone, email, time zone and availability window. Given a Network user starts on any screen, when they search a partner by name, LEI or BIC and open it, then the incident contact is visible within 3 interactions (type, select result, read header).
- **AC14 Overview tab content.** The Overview tab shows, read-only:
  - Roles, each with its key data: for Customer, the applicable contract reference and renewal date; for Partner, the connection method.
  - One line per contracted product with scheme, country, current stage, date it entered the stage, target go-live date and a blocked flag.
  - Key people: the active contact for each of champion, decision maker, technical, incident, escalation and billing, with the last-verified date.
  - The current owner.
  - "Latest interactions": the 5 most recent History entries, notes and events together (type, author, team, date, first line of summary). M10 uses the same list.
  - Active alerts, shown to every team: missing incident contact, LEI lapsed or invalid, KYB expired, incomplete for billing, renewal within 30 days and blocked product. "No active incident contact" is a critical (carmine) alert. Other team-specific worklist rules stay on the worklists.
  - When the entity belongs to a group, "Other entities in this group" with legal name, country, LEI and roles, each linked to its record.
- **AC15 Overview links.** Each Overview section has a link to its tab (Details, Products & onboarding, Contacts, History, Partner, Compliance, Billing). The Overview tab has no edit controls for any team. Entity core and role data are edited on the Details tab (AC20).
- **AC16 Permissions.** All 6 teams can search and open any non-deleted entity record. The Audit tab is visible only to Compliance and to the admin. The Partner tab is visible only when the entity has the Network partner role. The Products & onboarding tab is hidden for partner-only entities.
- **AC17 Audit logging.** Searching and viewing do not write audit log entries. Only data changes are logged (see M2 to M4).
- **AC18 Contract ID matching.** Given the user searches a contract ID, for example "IPE-MSA-2026-014", then the search matches it. A group master agreement result opens the Group record of the group that holds it, and an entity contract result opens the entity that holds it.
- **AC19 Result count and paging.** The results show a count (for example "12 institutions") and 25 rows per page. The query, filters and sort are kept in the URL, so a result list can be shared by link.
- **AC20 Details tab.** The entity record has a "Details" tab, second after Overview. It holds:
  - the entity core (legal name, aliases, type, country, LEI, BICs, group link), edited by Ops;
  - the Customer role card: contract reference (Ops), renewal date (CS), handoff summary with SLAs and special terms (Sales), commercial terms (Sales and Finance);
  - the Partner role card with the partner agreement reference (Ops);
  - the roles (Ops) and the lifecycle state, where Ops sets Inactive.

  Every section follows the M15 AC3 matrix and shows "Owned by <Team>" to read-only users. All 6 teams can open the tab.

**States:**

- **Empty (no query):** the search page shows the filter panel and the hint "Search by name, alias, LEI or BIC, or use filters."
- **Empty (no results):** "No institutions match '<query>'" with a "Clear filters" action. For Sales users only, a "New customer" button opens the wizard (M2) with the name pre-filled.
- **Loading:** a skeleton of result rows. The search box keeps the typed text and stays editable.
- **Error:** "Search is unavailable right now. Try again." with a Retry button. Filters and query are kept.
- **Record not found or deleted:** opening a link to a soft-deleted entity shows "This record was deleted on <date>. Contact the admin, Adrian Koh, if it should be restored." with no data displayed (M16 AC11).
- **Page not found:** a URL that matches no record or page shows "We couldn't find that page. Search for a customer or go to Home."
- **Overview sections without data:** each empty section shows a specific line, for example "No products recorded", "No active incident contact" (a critical alert, also shown in the header for partners) or "No History entries yet".
- **Read-only:** the Overview tab is read-only for every team. Fields on other tabs that the user cannot edit carry the label "Owned by <team>".

**Edge cases:**

1. One search term matches a legal name and an alias of 2 different entities, for example "Financial Services" matches the legal name "Adyen N.V." and the alias "Zopa Financial Services" of "Zopa Bank Limited". Both appear, each with its match reason.
2. An entity is both customer and partner, for example Lloyds Bank plc. It appears once in results with roles "Customer, Network partner", and the header shows the incident contact.
3. A group with several entities across countries, such as the "Santander" group: 4 seeded entities (Santander UK plc in GB, Banco Santander Totta, S.A. and Banco Santander Consumer Portugal S.A. in PT, Santander Consumer Bank S.p.A. in IT), plus Santander Consumer Bank GmbH in AT once it is created in scenario 1. A search for "Santander" returns each entity as a separate row with the same group name, and each row opens its own record.
4. An entity has 3 products in the same country (EU VoP, Global validation and a second EU VoP for a different contracting entity). The Overview lists 3 separate product lines, each with its own stage.
5. A partner has no active incident contact. The header shows "No active incident contact" as a critical (carmine) alert, and the search result row also shows this warning.
6. The country filter = GB is combined with scheme = EU VoP. Only entities matching both are listed, and when none exist the empty state appears.

**Out of scope (phase 2):**

- An automatically generated list of customers potentially affected by a partner (N6). The MVP uses the country and scheme filters.
- Monthly volume, actual vs. contracted volume and churn signals on the Overview (C8, C10).
- Showing billing system data or links (F8, F9).
- Exporting search results.

---

### A.M2: Create the customer record with GLEIF lookup and duplicate warning

**Story (EN):** As a Sales Director, I want to create the customer record when the deal closes, entering the type (bank, fintech, PSP), country, group and LEI, from which the portal fills in the legal name, country, LEI status and parent entity from GLEIF, and to be warned if an entity with the same LEI, BIC or a similar name already exists, so that teams start from the correct legal entity and no duplicates appear.

**Screens:** New customer wizard, step 1 "Entity and LEI" (screen 3). On submit, the entity record header (screen 4) and its History tab. The Group record (screen 5) when a group is created or selected.

**Acceptance criteria:**

- **AC1 Access.** Only Sales users see the "New customer" button (Home and empty search results) and can open the wizard. For other teams, the wizard URL shows "Only Sales can create a customer record" with a link to search.
- **AC2 Step 1 fields.**

  | Field | Rule |
  |---|---|
  | Type | Required. One of Bank, Fintech, PSP. |
  | LEI | Required. |
  | Country | Required. ISO 3166-1 alpha-2. |
  | Group | Optional. Pick an existing group, or "Standalone entity". |
  | BICs | Optional. One or more. |
  | Aliases | Optional. One or more, max 100 characters each. |
  | Legal name | Required. Filled from GLEIF. |

- **AC3 LEI format (ISO 17442).** The LEI must be exactly 20 characters, uppercase letters A-Z and digits 0-9, and its last 2 characters must pass the ISO 7064 MOD 97-10 check. Input is trimmed and converted to uppercase. An invalid value shows "LEI must be 20 letters or digits and pass the ISO 17442 check" and blocks the GLEIF lookup.
- **AC4 BIC format (ISO 9362).** Each BIC must be 8 or 11 characters and match: 4 letters (institution), 2 letters forming a valid ISO 3166-1 country code, 2 letters or digits (location), and an optional 3 letters or digits (branch). Input is converted to uppercase. An invalid value shows "BIC must be 8 or 11 characters (e.g. ABBYGB2L or ABBYGB2LXXX)" and blocks Next. A BIC whose country code differs from the entity country shows a non-blocking warning.
- **AC5 GLEIF lookup.** Given a valid LEI, when the field loses focus or the user clicks "Look up", then the portal calls GLEIF and fills: legal name, legal address country, LEI registration status, next renewal date, and direct and ultimate parent (LEI and legal name) when GLEIF reports them. A field filled from GLEIF shows the tag "From GLEIF" and the lookup time. The portal calls the live GLEIF API. In `DEMO_MODE`, when GLEIF is unreachable, a demo LEI is answered from the cached copy of its GLEIF record (see Shared conventions).
- **AC6 Country check.** Given the country chosen by the user differs from the GLEIF legal address country, then the portal shows "GLEIF records <XX> for this LEI" and sets the country to the GLEIF value. The user can switch it back, and that choice is logged.
- **AC7 LEI status handling.**

  | GLEIF status | Behaviour |
  |---|---|
  | ISSUED | Accepted with no warning. |
  | LAPSED | Amber warning "LEI lapsed on <date>". The user can continue. The entity shows the "LEI lapsed" badge and appears on the Compliance worklist. |
  | RETIRED, MERGED, ANNULLED, DUPLICATE | Red warning "This LEI is no longer valid for this entity". If GLEIF names a successor LEI, the portal offers "Use successor LEI <LEI>". Continuing with the original LEI requires a reason (min 10 characters), which is saved to History. |
  | PENDING_TRANSFER, PENDING_ARCHIVAL | Amber warning with the status. The user can continue. |

- **AC8 Group from the GLEIF parent.**
  - Given GLEIF returns an ultimate parent LEI that matches the parent LEI of a portal group, then that group is pre-selected with "Suggested from GLEIF parent".
  - Given GLEIF returns a parent LEI that matches no portal group, then the user can choose "Create group from GLEIF parent". The group, with the parent's legal name, parent LEI and headquarters country, is created at submit in the same transaction as the entity (M3 AC10). Discarding the wizard creates no group.
  - Given the user picks a group whose parent LEI differs from the GLEIF parent, then a non-blocking warning shows both values.
- **AC9 Duplicate check triggers.** The duplicate check runs when the LEI lookup completes, when a BIC is added and when the legal name or an alias changes. It compares the values against all entities, including soft-deleted ones (edge case 5).
- **AC10 Duplicate rules.** A possible duplicate is any of these:
  - same LEI;
  - any BIC with the same first 8 characters;
  - a legal name or alias equal after normalisation (lowercase, diacritics removed, punctuation removed, legal forms removed: plc, SA, S.A., S.p.A., AG, Ltd, DAC, B.V., N.V., GmbH);
  - a trigram similarity of 0.85 or higher between normalised names, with the threshold set in configuration.

  Example: "Santander Consumer Bank GmbH" and "Santander Consumer Bank S.p.A." both normalise to "santander consumer bank", so the name warning fires.
- **AC11 Duplicate warning panel.** Given one or more matches, then a warning panel lists up to 5 matches. For each it shows the match reason (LEI, BIC, Name), legal name, country, LEI, roles, current owner and lifecycle state, plus an "Open record" link that opens in a new tab.
- **AC12 Continue despite a warning.** Given a warning is shown, the user can continue only after ticking "I checked these records and this is a different legal entity" and entering a reason (min 10 characters). The reason is saved as a History entry on the new record. The portal never blocks creation because of a duplicate warning.
- **AC13 Existing partner entity.** Given the LEI match is an entity with the Network partner role and no Customer role, then the panel shows "Add Customer role to this existing entity" as the main action. Choosing it continues the wizard on the existing entity: step 1 becomes read-only, no duplicate reason is asked, steps 2 to 4 add the Customer role, products and handoff to that record, and no new entity is created. The current owner stays unchanged until the Sales → Ops handoff is confirmed (M3 AC12).
- **AC14 Record creation.** The entity is created when the wizard is submitted at step 4 (see M3). On creation:
  - lifecycle state = Onboarding;
  - current owner = the Sales user who created it;
  - LEI status and GLEIF lookup time are stored.
- **AC15 Leaving the wizard.** Leaving the wizard before submitting asks "Discard this new customer?". Confirming discards all wizard data, and nothing is saved.
- **AC16 Ownership after creation.** After creation, Ops owns the entity fields (legal name, aliases, type, country, LEI, BICs, group) and edits them on the Details tab (M1 AC20), including LEI corrections. Sales and the other teams see them read-only with the label "Owned by Ops".
- **AC17 Audit logging.** On creation, the audit log writes one entry per field set: object = Legal entity, field, old value = empty, new value, user, team, timestamp (UTC, shown in the viewer's local time). The following are also logged: duplicate overrides (with reason), country overrides, invalid-LEI-status overrides and group creation.
- **AC18 History timeline.** The new record's History shows the automatic event "Record created by <name> (Sales)", plus "Duplicate warning acknowledged: <reason>" or "LEI status override: <reason>" when they apply.
- **AC19 Worklists.** A created entity with LEI status LAPSED (or any status AC7 marks invalid), or with an LEI renewal date within 30, 60 or 90 days, appears on the Compliance worklist in the matching bucket. A required entity field that is still empty appears on the Ops worklist "Required fields empty".

**States:**

- **Empty:** step 1 opens with every field blank, the LEI field focused, and the helper "Enter the LEI to fill the legal data from GLEIF".
- **Loading:** a spinner inside the LEI field with "Looking up GLEIF...". Next stays disabled until the lookup finishes or fails.
- **Error, GLEIF unavailable** (timeout after 5 seconds or a server error): "GLEIF is unavailable. You can retry or enter the legal name and country manually." Once the legal name and country are entered manually, the entity saves with LEI status "Not verified with GLEIF". Ops sees a "Retry GLEIF lookup" action on the entity header.
- **Error, LEI not found:** "No GLEIF record for <LEI>. Check the LEI with the customer." Next is blocked until the user corrects the LEI, or until they enter the details manually with a reason, which is saved to History. A record saved this way stores the LEI status "Not verified with GLEIF", the same as when GLEIF is unavailable.
- **Error, LEI lapsed or invalid status:** as AC7.
- **Read-only for non-owners:** non-Sales users cannot open the wizard (AC1). After creation, entity fields are read-only for everyone except Ops (AC16).

**Edge cases:**

1. The same LEI already exists as a customer record, for example "Banca Monte dei Paschi di Siena S.p.A." owned by CS. The warning shows the existing record with its owner. The expected action is "Open record", and continuing requires the confirmation and reason.
2. The entity already exists as a network partner. The user adds the Customer role to the existing entity (AC13), and the entity then shows roles "Customer, Network partner".
3. The group parent is not in the portal, for example GLEIF reports "UniCredit S.p.A." (549300TRUWO2CD2G5692) as ultimate parent and no group has that LEI. The user creates the group from the GLEIF parent at submit, and the parent itself does not need its own entity record.
4. The name is similar with a different LEI, for example "Santander Consumer Bank GmbH" (AT, 5299000I7Y60A8273788) vs. existing "Santander Consumer Bank S.p.A." (IT, 549300O0YQXDOJB36Y73). A name warning appears. The user confirms it is a different legal entity, and the reason is saved. This is the scenario 1 path.
5. The same LEI belongs to a soft-deleted entity. The warning shows "A deleted record with this LEI exists. Ask the admin to reactivate it." with the deleted record's name and deletion date. Continuing requires the confirmation and reason.
6. A fintech enters a BIC8 that matches an existing bank's BIC11. A BIC warning appears, because the 2 records likely share an institution code.

**Out of scope (phase 2):**

- Merging 2 duplicate records (O5). The MVP only warns.
- Saving the wizard as a draft and resuming it later. The MVP has no drafts (AC15).
- Scheduled automatic GLEIF re-checks and change monitoring (CO10).
- Email notifications about new records.
- Making Sales fields read-only after handoff, with correction requests (S9).

---

### A.M3: Record what was contracted and hand over to Onboarding

**Story (EN):** As a Sales Director, I want to record the contracted products, countries and entities, the commercial terms (price per verification, volume tiers, monthly minimum, payment term), the promised SLAs, special terms and the target go-live date for each product, then hand the customer over to a named Onboarding Manager, who sees it in the "To pick up" list and confirms the pickup, so that Ops and Finance receive everything I promised in one place and the owner is clear from day one.

**Screens:** New customer wizard, step 2 "Products, countries and commercial terms", step 3 "Initial contacts" (fields defined in M7) and step 4 "Handoff summary and Onboarding Manager" (screen 3). Home worklist "To pick up" (screen 1). Handoff confirmation (screen 6). Entity record header, Overview, Products & onboarding tab and History tab (screen 4).

**Acceptance criteria:**

- **AC1 Product lines.** In step 2, Sales adds one or more product lines. Each line has:
  - product or scheme (EU VoP, UK CoP, Global validation), required;
  - country (ISO 3166-1 alpha-2), required;
  - contracting entity, required: the entity from step 1 by default. The picker lists the new entity and every entity of the group chosen in step 1;
  - target go-live date, required.

  At least 1 product line is required to continue.
- **AC2 Product and country rules.** The combination of product, country and contracting entity must be unique within the customer.
  - UK CoP lines allow only country GB.
  - EU VoP lines allow only countries in the SEPA scheme area.
  - Global validation allows any country.

  A rule violation shows an inline error on that line.
- **AC3 Target go-live date.** The date must be valid. A date in the past shows "Target go-live is in the past" and blocks Next.
- **AC4 Entities not yet in the portal.** A free-text field "Contracted entities not yet in the portal" (max 1,000 characters) lets Sales list other group entities covered by the contract, for example "Santander Consumer Bank GmbH, LEI 5299000I7Y60A8273788". It is part of the handoff summary so that Ops can create and link them (M4).
- **AC5 Commercial terms.** Commercial terms are entered once per customer:
  - currency (EUR, GBP, USD), required;
  - price per verification: decimal greater than 0, max 4 decimals, required;
  - volume tiers: optional rows of "from volume", "to volume" and "price per verification". Volumes are whole numbers, tiers ascend, do not overlap and leave no gaps, and the last tier may have an empty "to";
  - monthly minimum: decimal of 0 or more, optional;
  - payment term in days: whole number from 1 to 180, required.
- **AC6 Promised SLAs.** SLAs are optional per customer:
  - availability %: decimal from 90.00 to 100.00, for example 99.95;
  - maximum response time in milliseconds: whole number greater than 0;
  - free-text "Other SLA commitments", max 1,000 characters.
- **AC7 Special terms.** Special terms are free text, max 2,000 characters, for example "Pilot pricing for first 3 months in DE".
- **AC8 Step 3, initial contacts.** Sales adds the initial business contacts, including the champion. Contact fields and validation follow M7. At least 1 contact with role Champion or Decision maker is required to continue. Sales adds Champion and Decision maker contacts only. The missing technical and incident contacts put the new customer on the Ops worklist "Required fields empty" (M11 AC9). This is intended: it is the first job Ops picks up.
- **AC9 Step 4, handoff summary.** Step 4 shows a read-only summary of steps 1 to 3, an optional "Notes for Onboarding" field (max 2,000 characters) and a required "Onboarding Manager" selector. The selector lists only active portal users from the Ops team.
- **AC10 Submit.** When Sales clicks "Create customer and hand over", then in one transaction the portal:
  - creates the entity (M2), the Customer role with the handoff summary, the product lines and the contacts;
  - creates the group chosen from the GLEIF parent, when the user picked "Create group from GLEIF parent" (M2 AC8);
  - sets every product line to stage "Contract signed", with the stage entry date = today;
  - creates a Handoff record with type `Sales → Ops`, from = Sales user, to = selected Onboarding Manager, status = Sent and sent date = now. The handoff summary is a snapshot taken at submit, like the Ops → CS summary (M8 AC3). Later edits to the record do not change it.

  If any part fails, nothing is saved and the wizard keeps all entered data.
- **AC11 "To pick up" list.** Given a handoff with status Sent, then it appears on the Home "To pick up" list of the named Onboarding Manager. The row shows legal name, country, products, the earliest target go-live, Sales sender and days since sent. Other Ops users see it only under the "My team" scope, read-only, with the recipient named (M11 AC3).
- **AC12 Confirm pickup.** Given the named Onboarding Manager opens the handoff, then they see the full handoff summary and a "Confirm pickup" button. When they confirm:
  - handoff status changes to Confirmed, with confirmation date = now;
  - the current owner of the entity changes from the Sales user to the Onboarding Manager;
  - the item leaves "To pick up".

  Only the named recipient can confirm.
- **AC13 Owner before confirmation.** Until confirmation, the entity header shows the current owner = Sales user and the banner "Handoff to <Onboarding Manager> pending since <date>". For Sales, the banner has a "Change Onboarding Manager" action that opens a dialog listing active Ops users (edge case 3).
- **AC14 Who can edit.** Before and after the handoff, Sales and Ops can edit product lines (product, country, contracting entity, target go-live), and every change requires a reason (M6 AC10). Sales can edit the SLAs, special terms and initial contacts in the MVP. Commercial terms are editable by Sales and Finance. CS also edits Champion and Decision maker contacts (M7 AC3). CS, Network and Compliance see the other fields read-only with "Owned by <Team>". From the moment product lines exist, onboarding stage changes belong to Ops (M6).
- **AC15 Finance access.** Finance can open the handoff summary on the entity record (Customer role card on the Details tab, M1 AC20) and sees the commercial terms, SLAs and special terms without asking Sales.
- **AC16 Audit logging.** Every field created or changed in steps 2 to 4, and every later edit, writes an audit entry: object (Product line, Customer role, Contact, Handoff), field, old value, new value, user, team, timestamp. Confirming the handoff also logs the owner change (old owner, new owner).
- **AC17 History timeline.** History shows these automatic events:
  - "Handoff sent to <Onboarding Manager> by <Sales user>";
  - "Handoff confirmed by <Onboarding Manager>";
  - "Owner changed from <Sales user> to <Onboarding Manager>";
  - "Product line added: <product>, <country>, target go-live <date>";
  - "Commercial terms changed". Compliance and the admin see a link to the audit details. Other teams see the old and new values inline (M10 AC5).
- **AC18 Worklists.**
  - A product line with a target go-live within 14 days, not yet at stage "Live & hypercare" or later, appears on the Ops worklist "Go-lives in the next 14 days" of the current owner, following the M11 AC3 scope rules.
  - A product line past its target go-live and not live appears on the Sales worklist "Overdue go-lives" of the Sales user who created the customer.
  - A handoff still Sent after 2 business days stays at the top of "To pick up", marked "Waiting <n> days" (M11 AC5).

**States:**

- **Empty:** step 2 opens with one blank product line and empty commercial terms. "To pick up" with no items shows "Nothing to pick up. New customers from Sales appear here."
- **Loading:** step transitions and submit show a progress state on the primary button, and fields lock until the response arrives.
- **Error (validation):** inline field errors. Next and Submit stay disabled until the step is valid, and the step indicator marks the steps with errors.
- **Error (submit failed):** "The customer could not be created. Nothing was saved. Try again." All entered data is kept.
- **Error (no Ops users available):** if the Onboarding Manager selector is empty, "No active Onboarding Manager found. Contact the portal admin." and Submit is disabled.
- **Read-only for non-owners:** on the entity record, Customer role and product fields show their owner label ("Owned by Sales", "Owned by Ops", or "Owned by Sales and Finance" on the commercial terms) for teams without edit rights. Users other than the named recipient see the handoff with no "Confirm pickup" button.

**Edge cases:**

1. Multiple products per country, for example EU VoP and Global validation both in IT for "Banca Monte dei Paschi di Siena S.p.A.". There are 2 product lines with separate target go-live dates and separate stages. A second EU VoP line in IT for the same contracting entity is rejected as a duplicate line.
2. Same product in several countries, for example EU VoP in DE, FR and NL with go-live dates spread over 3 months. There are 3 lines, and each one shows on "Go-lives in the next 14 days" only when its own date falls in the window.
3. The named Onboarding Manager, Adrian Koh, is on leave and the handoff stays Sent. Sales uses "Change Onboarding Manager" on the pending handoff banner and picks Kevin Lim while the status is Sent. The item moves to the new recipient's "To pick up", and the change is logged and shown in History.
4. A contracting entity in another country of the group, for example the UK CoP line belongs to "Santander UK plc" while the customer record is "Banco Santander Totta, S.A.". The product line shows the UK entity as contracting entity. The band and its stage controls live on the customer record, and the UK entity's Overview lists the product read-only.
5. Volume tiers with a gap, such as 0-100,000 and 150,001-500,000, show an inline error "Tiers must be continuous" on the second tier.
6. Sales edits the commercial terms after the Onboarding Manager confirmed the pickup. The edit is allowed in the MVP, written to the audit log and shown in History so Ops and Finance can see the change.
7. The entity is soft-deleted (M16) while the Sales → Ops handoff is Sent. A pickup attempt fails with "This record was deleted. Contact the admin to reactivate it." After reactivation, the handoff returns with status Sent.

**Out of scope (phase 2):**

- Locking Sales fields as read-only after handoff and requesting corrections (S9).
- Email notifications and automatic reminders for pending handoffs (S8).
- Recording monthly actual volume vs. contracted volume (C8).
- Links to the billing system and contract-to-invoice reconciliation (F8, F9).
- Rejecting or returning a handoff to Sales.

---

### A.M4: Link group entities, attach contracts and set roles

**Story (EN):** As an Onboarding Manager, I want to link the legal entities of a group (for example Santander UK plc and Banco Santander Totta, S.A.) under the group entity, attach the applicable contract to each entity and mark each one with the role of customer, network partner or both, so that teams see the exposure across the group, Finance knows which entity is invoiced, and during an incident or a renewal it is clear which entity and which contract are affected.

**Screens:** Group record (screen 5). Entity record header (group link, roles) and Overview tab (screen 4). The Partner tab appears or disappears based on the role. History tab (screen 4).

**Acceptance criteria:**

- **AC1 Group record content.** The Group record shows the group name, parent LEI, headquarters country and a table of member entities. For each entity it shows legal name, country, LEI, LEI status, BICs, roles, applicable contract (reference and title), invoiced entity, and the products with their current stages. Each entity name links to its record.
- **AC2 Group exposure summary.** Above the table, the group summary shows:
  - number of entities;
  - number with role Customer, Network partner and Both;
  - number of product lines per stage;
  - countries covered;
  - number of entities with no contract attached.
- **AC3 Link an entity.** Given an Ops user on the Group record, when they click "Link entity" and pick an existing non-deleted entity through search (name, alias, LEI, BIC), then that entity's group is set to this group. Given the entity's GLEIF parent LEI differs from the group's parent LEI, then a non-blocking warning shows both values before saving.
- **AC4 Entity already in another group.** When the selected entity already belongs to another group, the portal asks "Move <entity> from <old group> to <new group>?" and saves only after confirmation.
- **AC5 Unlink an entity.** An Ops user can unlink an entity from the group. The entity becomes "Standalone entity", and its roles, contracts and products stay unchanged.
- **AC6 Create a group.** An Ops user can create a group from the entity record (Details tab) or from search with:
  - group name: required, max 200 characters, unique among groups after normalisation;
  - parent LEI: optional, same format and GLEIF lookup as M2 AC3 and AC5;
  - headquarters country: required, ISO 3166-1 alpha-2.

  A parent LEI is allowed even when no entity record exists for the parent.
- **AC7 Roles.** On each entity's Details tab, an Ops user sets the roles: Customer, Network partner, or both. Every entity must have at least 1 role. Adding Network partner makes the Partner tab visible to all teams, editable by Network (M5). Adding Customer creates an empty Customer role (contract, renewal date, handoff summary).
- **AC8 Removing a role with data.** Removing a role that has data asks for confirmation and lists what will be hidden, for example "3 coverage rows" or "2 product lines". After confirmation the role is deactivated and its data is kept. Re-adding the role restores the data.
- **AC9 Contract reference.** On each entity's Customer role card (Details tab), Ops attaches the applicable contract as a contract reference:
  - contract ID: required, 3 to 50 characters; letters, digits, `-`, `/`, `_`. Example: `IPE-MSA-2026-014`. Finance sees it read-only as the contract reference on the Billing tab (M14);
  - title: required;
  - signing date: required, not in the future;
  - scope: Entity contract or Group master agreement;
  - invoiced entity: required, one of the group entities, the entity itself by default;
  - document link: required, a URL starting with https://.
- **AC10 Group master agreement.** A contract with scope "Group master agreement" can be applied to several entities of the same group without re-entering it. Selecting it on an entity shows "Applies to <n> entities" with their names.
- **AC11 Partner agreement reference.** On the Partner role card of the Details tab, Ops attaches the partner agreement reference with the same fields as AC9, without "invoiced entity". The obligations inside contracts and partner agreements are entered by Compliance (M13).
- **AC12 Permissions.** Ops edits groups, group links, roles, contract references and partner agreement references (M15 AC3). Sales, CS, Network, Compliance and Finance see all of them read-only, with the label "Owned by Ops".
- **AC13 Audit logging.** Each of these writes an audit entry with object, field, old value, new value, user, team and timestamp: link, unlink, group move, group create or edit, role add, role remove, contract reference add, edit or remove, and invoiced entity change. A group move logs old group and new group.
- **AC14 History timeline.** History on each affected entity shows events such as:
  - "Linked to group <name> by <user>";
  - "Moved from <group A> to <group B>";
  - "Role added: Network partner";
  - "Role removed: Customer";
  - "Contract <ID> attached";
  - "Invoiced entity changed to <entity>".

  When a group master agreement changes, every entity that uses it gets the History event.
- **AC15 Worklists.** On the Ops worklist "Required fields empty", an entity with the Customer role and no contract reference appears as "No contract attached", and an entity with roles and no group decision (neither a group nor "Standalone entity" confirmed) appears as "Group not set".
- **AC16 Incident and renewal answer.** Given a contract ID or a group, when a user opens the Group record, then they can see in one table which entities that contract covers, which entity is invoiced, and the roles and product stages of each entity.

**States:**

- **Empty:** a group with no linked entities shows "No entities linked yet" and, for Ops, the "Link entity" button. An entity with the Customer role and no contract shows "No contract attached" in amber on the Overview and on the Group table.
- **Loading:** a skeleton of the group table. The link dialog shows a loading state while search runs.
- **Error (save failed):** "Changes were not saved. Try again." The previous values stay in place.
- **Error (GLEIF unavailable for the parent LEI):** same behaviour as M2. The group saves with the parent LEI marked "Not verified with GLEIF".
- **Error (invalid input):** inline errors for duplicate group name, invalid LEI, a URL that does not start with https:// and a future signing date.
- **Read-only for non-owners:** the group table, roles and contract references show no edit controls, with "Owned by Ops".

**Edge cases:**

1. An entity is both customer and network partner, for example "Banco Santander Totta, S.A." sends verifications and answers EU VoP checks in PT. Both roles are set, the Customer role carries the customer contract, the Partner role carries the partner agreement, and the header shows the incident contact.
2. The group parent is not in the portal: the group "Santander" is created with the parent LEI of Banco Santander S.A. (5493006QMFDDMYWIAM13) from GLEIF and no parent entity record. The group screen works with only the subsidiaries linked.
3. The Santander group has 4 seeded entities. The group master agreement covers 3 of them, and Santander Consumer Bank S.p.A. has its own local contract. The Group table shows the master agreement on 3 entities and the local contract on the fourth.
4. The invoiced entity differs from the contracting entity, for example Santander UK plc uses the service and the master agreement says Banco Santander Totta, S.A. is invoiced. Finance sees Banco Santander Totta, S.A. as the invoiced entity on both rows, and the Santander UK plc billing profile shows "Billed through Banco Santander Totta, S.A." (M14 AC15).
5. An entity is linked to the wrong group and moved: the move confirmation appears, both moves are logged, and the entity disappears from the old group's table and counts.
6. The Partner role is removed while coverage rows exist. A confirmation lists the coverage rows, the Partner tab disappears after saving, and re-adding the role shows the same coverage rows again.

**Out of scope (phase 2):**

- An automatically generated list of customers affected by a partner incident (N6).
- Storing contract PDF files in the portal and extracting their terms automatically. The MVP stores a reference and a link.
- Group-level actual volume and revenue exposure (C8, C10).
- Syncing invoiced entities with the billing system (F8, F9).
- Merging duplicate entities found while building a group (O5).
- Admin screens for managing groups in bulk.

---

### A.M5: Partner coverage by country and scheme

**Story (EN):** As a Network Manager, I want to record on an entity's partner role the countries covered, the schemes (EU VoP, UK CoP, Global validation), the connection method (direct, via scheme or via routing provider) and the status for each country and scheme (Onboarding, Active, Degraded, Suspended, Retired), with the date and reason for each change, so that Ops and CS see the same coverage state and we know which connection path is involved in an incident.

**Screens:** Entity record (screen 4): Partner tab, header role chips, Overview tab (coverage summary). Search and results (screen 2): country and scheme filters. History tab (timeline events). Audit tab.

**Acceptance criteria:**

- **AC1: Tab visibility.** Given an entity has the partner role (set in M4), when any user opens the entity record, then the Partner tab is shown. Given an entity has only the customer role, then the Partner tab is hidden and no coverage data can be created for it.
- **AC2: Connection method.** The partner role holds one connection method with allowed values `Direct`, `Via scheme`, `Via routing provider`. When `Via routing provider` is selected, Provider name is required (2 to 120 characters). When the method changes from `Via routing provider` to another value, Provider name is cleared, and the old value stays in the audit log.
- **AC3: Coverage row fields.** A coverage row holds: Country (ISO 3166-1 alpha-2, chosen from a searchable list), Scheme (`EU VoP`, `UK CoP`, `Global validation`), Status, Status effective date, Status reason. All five are required.
- **AC4: Country and scheme consistency.** Given Scheme = `UK CoP`, then Country must be `GB`. Given Scheme = `EU VoP`, then Country must be a SEPA scheme country, using a static list held in configuration. `Global validation` accepts any country. When the rule fails, the Save button stays disabled and an inline message appears, for example "UK CoP coverage must use country GB".
- **AC5: Uniqueness.** One partner entity has at most one coverage row per Country + Scheme pair. Given Adyen N.V. already has `NL / Global validation`, when a Network user adds `NL / Global validation` again, then saving is blocked with the message "Coverage for NL / Global validation already exists" and a link to the existing row.
- **AC6: New row default.** When a Network user adds a coverage row, Status defaults to `Onboarding`, the effective date defaults to today and the reason defaults to "Initial coverage". The user can edit all three before saving. The effective date can be up to 30 days in the future (AC17).
- **AC7: Status change.** Given a coverage row exists, when a Network user changes its status, then a dialog requires: the new status (any of the other four values), an effective date (default today, up to 30 days in the future, no earlier than the effective date of the current status) and a reason (5 to 500 characters). On save, the row shows the new status, the date and the reason, and the previous status moves into the row's status history.
- **AC8: Allowed transitions.** Every status can move to every other status, because a partner can degrade, recover, be suspended and return. Moving out of `Retired` is allowed only to `Onboarding`, and the dialog shows the hint "Re-onboarding a retired coverage".
- **AC9: Status history.** Each coverage row has an expandable history listing every status with effective date, reason, user and timestamp, newest first. History entries are read-only for all teams.
- **AC10: No hard delete.** Coverage rows have no delete action. A row created by mistake is set to `Retired` with a reason (for example "Created in error"). Retired rows are collapsed under "Retired coverage (n)" at the bottom of the tab.
- **AC11: Visual status.** The tab lists coverage grouped by Scheme, then sorted by Country. Status badges use distinct styles: Onboarding (neutral), Active (positive), Degraded (warning), Suspended (critical), Retired (muted). Each row shows "since <effective date>" and how many days the row has been in that status.
- **AC12: Overview and header.** Given any coverage row is `Degraded` or `Suspended`, then the Overview tab shows an active alert, for example "Partner coverage issue: GB / UK CoP Degraded since 28 Sep 2026", and the partner role chip in the header carries a warning indicator. The Overview also shows coverage counts by status (for example "Active 12, Degraded 1, Onboarding 2").
- **AC13: Permissions.** Network users can create and edit the connection method and coverage rows. Every other team (Sales, Ops, CS, Compliance, Finance) sees the Partner tab read-only, with the label "Owned by Network" and no edit controls rendered. Partner agreement obligations (M13) appear on this tab as a read-only link to the Compliance tab.
- **AC14: Audit.** Every create and every change to a coverage row or the connection method writes one audit entry per changed field: object (Partner role or Coverage row with country and scheme), field, old value, new value, user, team, date and time.
- **AC15: History timeline.** Every coverage status change creates a History event under the "Network and structure" filter (M10 AC8), in the form "Coverage GB / UK CoP: Active → Degraded (effective 28 Sep 2026). Reason: response times above 2s. By Lukas Brenner, Network." This is the scenario 2 example on Lloyds Bank plc. A connection method change creates the event "Connection method: Direct → Via routing provider (ClearRoute Services)".
- **AC16: Search.** Given coverage rows exist, when a user filters search results by Country and Scheme and the Partner role (M1), then partner entities with a coverage row matching that pair are returned, and each result shows the coverage status for that pair. Retired rows are excluded unless the user adds `Retired` to the partner coverage status filter (M1 AC5).
- **AC17: Scheduled status.** Given a coverage row or a status change has an effective date after today (at most today + 30 days), then the row shows the badge "Scheduled" with the text "Scheduled: <status> from <date>". Until that date, the previous status stays in force for alerts, search and the Overview (a new row counts as having no status yet). On the effective date the scheduled status becomes current with no user action. A date more than 30 days ahead blocks the save with "Effective date can be at most 30 days ahead".

**States:**
- **Empty:** the partner role has no coverage rows. The tab shows "No coverage recorded yet." For Network users it adds the button "Add coverage". Other teams see the text only.
- **Loading:** a skeleton of the scheme groups and the connection method block. The edit controls stay disabled until data has loaded.
- **Error:** if loading fails, the tab shows "Coverage could not be loaded" with a Retry button. If saving fails, the dialog stays open with the entered values kept and the message "Change not saved. Try again." No partial row is created.
- **Read-only for non-owners:** the same layout with no Add or Change status buttons. Status history can still be expanded. The tab shows the label "Owned by Network".

**Edge cases:**
1. A partner reached through a routing provider has `EU VoP` coverage in 14 countries, and the provider has an outage. Network must change each affected row separately: MVP has no bulk status change. The connection method shown on the Partner tab tells Ops that the path is ClearRoute Services.
2. A user enters an effective date before the current status's date to correct a late entry. Saving is blocked with "Effective date cannot be earlier than 12 Sep 2026 (current status date)".
3. Two Network users change the same row at the same time. The second save is rejected with "This coverage was updated by Nora Lee at 10:42. Reload to see the latest status." and the newer value is kept.
4. The partner role is removed from the entity in M4 while coverage rows exist. The Partner tab is hidden, the rows and their history stay stored and visible in the audit log, and they show again if the role is re-added.
5. Lloyds Bank plc is both a customer and a partner. Its coverage status has no effect on the onboarding stages of its customer products (M6). The two are tracked independently.

**Out of scope (phase 2):**
- Automatically generated list of customers potentially affected by a partner issue (N6). MVP approximates this with the country and scheme search filters.
- Email notifications or reminders on coverage status changes.
- Bulk status changes across several coverage rows.
- Real routing data linking customers to the partners that answer their verification requests.
- Admin screens to maintain the SEPA country list.

---

### A.M6: Onboarding stage per product and scheme

**Story (EN):** As an Onboarding Manager, I want to update the onboarding stage separately for each product and scheme (from Contract signed to BAU), with the date the stage was entered, and to mark when a stage is blocked, by whom (Customer, Corvane, Partner) and why, so that Sales, CS and Finance can see from the record what is live and what is blocked, and Finance knows when billing can start.

**Screens:** Entity record (screen 4): Products & onboarding tab, Overview tab (products and stages, active alerts), header lifecycle state. Home worklist (screen 1) for Ops and Sales. Search and results (screen 2): stage filter. History tab. Audit tab.

**Acceptance criteria:**

- **AC1: One band per contracted product.** Each contracted product (Product or scheme + Country, created in M3) shows as one horizontal band with the 9 stages in this fixed order: 1 Contract signed, 2 Kickoff, 3 Sandbox & technical integration, 4 Testing & certification, 5 UAT, 6 Go-live approval, 7 Live & hypercare, 8 Ramp-up, 9 BAU. Completed stages, the current stage and future stages have distinct styles. Each band shows: product and country, current stage, stage entry date, days in current stage, target go-live date and blocked flag.
- **AC2: Initial stage.** A product created in M3 starts at `Contract signed`, with the entry date equal to today, the date of the M3 submit (M3 AC10).
- **AC3: Independence.** Given Revolut Ltd has `EU VoP / DE`, `UK CoP / GB` and `Global validation / SG`, when Ops moves `UK CoP / GB` to `UAT`, then the other two bands stay unchanged.
- **AC4: Move forward.** Given a product is at stage N, when an Ops user selects "Change stage" and picks stage N+1, then the dialog requires an entry date (default today, no later than today, no earlier than the entry date of stage N) and accepts an optional note (max 500 characters). On save, the band shows stage N+1 with the new entry date, and "days in stage" resets to 0.
- **AC5: Skip stages.** Given a product is at stage N, when Ops picks a stage later than N+1, then a reason is also required (5 to 500 characters), for example "Certification waived: existing EPC VoP participant". The skipped stages are shown as "Skipped" on the band, and the reason is stored with the change.
- **AC6: Move backwards.** Given a product is at stage N, when Ops picks any earlier stage, then a reason is required (5 to 500 characters) and the dialog shows "Moving back from Testing & certification to Sandbox & technical integration". On save, the band shows the earlier stage with the new entry date, and the stages after it return to future style. The backward move is labelled "Stage moved back" in History and in the audit log.
- **AC7: Set blocked.** When an Ops user selects "Mark as blocked" on a product, then the dialog requires Blocked by (`Customer`, `Corvane`, `Partner`) and a reason (5 to 500 characters). Blocked since is set automatically to today. The band shows a blocked badge with "Blocked by Customer since 24 Sep 2026: waiting for production certificates from the customer's security team".
- **AC8: Edit or clear the block.** Ops can edit Blocked by and the reason of an open block. Each edit is logged. When Ops selects "Resolve block", a resolution note is optional (max 500 characters). The badge is removed, and History records the block duration in days.
- **AC9: Stage change while blocked.** A stage change leaves an open block in place. The stage change dialog shows the open block with a "Resolve block" checkbox, unchecked by default.
- **AC10: Target go-live date.** The target go-live date from M3 is shown on each band. Ops and Sales can edit it in MVP, and every change requires a reason and is logged. Given today is later than the target date and the product is before `Live & hypercare`, then the band shows "Go-live overdue by n days".
- **AC11: Billing start.** Given a product enters `Live & hypercare`, then the band and the Overview show "Billable from <entry date of Live & hypercare>" for that product. Finance can see this on every product. Given the product later moves back before `Live & hypercare`, then the indicator is removed and History records "Billable from date removed".
- **AC12: Entity lifecycle state.** The lifecycle state in the header is recalculated after every stage change: `Onboarding` while no product has reached `Live & hypercare`. `Live` when at least one product is at `Live & hypercare` or later. `BAU` when every product is at `BAU`. The `Inactive` state is outside this rule and stays unchanged by stage changes. Partner-only entities have no products: they are `Live` when at least one coverage row is Active or Degraded, otherwise `Onboarding` (decision B1, section 1.6).
- **AC13: Overview.** The Overview tab lists every product with its current stage, a blocked badge if blocked, and the billing start indicator if present. Active alerts include each open block and each overdue go-live.
- **AC14: Worklists (M11).** Stage data feeds these items: Ops worklist: products over the M11 AC6 stage threshold (Ramp-up and BAU excluded), open blocks (with Blocked by and days blocked), "Go-lives in the next 14 days". Sales worklist: "Overdue go-lives" on entities the Sales user created. Each worklist item links to the band on the Products & onboarding tab.
- **AC15: Permissions.** Ops users can change stage, set, edit and resolve blocks, and edit the target date. Sales can edit the target date (Sales field, locked in phase 2). All other teams see the tab read-only, with the label "Owned by Ops".
- **AC16: Audit.** Each stage change, block change and target date change writes audit entries per field (object = Contracted product with product and country, field, old value, new value, user, team, date and time). Reasons are stored with the entry.
- **AC17: History timeline.** Each change creates a History event, for example "EU VoP / DE: UAT → Go-live approval (entered 01 Oct 2026). By Adrian Koh, Ops", "UK CoP / GB marked blocked by Partner: partner bank sandbox unavailable", "UK CoP / GB block resolved after 6 days".
- **AC18: Add product line.** Given an Ops user on the Products & onboarding tab, when they select "Add product line", then a form asks for product or scheme, country, contracting entity and target go-live date, with the M3 AC1 to AC3 rules. On save, the line starts at `Contract signed` with entry date today, and History records "Product line added: <product>, <country>, target go-live <date>" (M3 AC17).
- **AC19: Cancel a product line.** Product lines are never deleted. An Ops user can select "Mark as cancelled" on a line, with a required reason (5 to 500 characters). The band shows a "Cancelled" badge with the date and reason, its stage and block controls are hidden, and the line no longer counts for worklists (M11) or the lifecycle state (AC12). The change is audited and shown in History.
- **AC20: Tab visibility.** The Products & onboarding tab is hidden for entities that hold only the Network partner role.
- **AC21: Where the band lives.** The band and its stage controls live on the customer record that holds the product line. When the contracting entity is another entity of the group, that entity's Overview lists the product read-only, with a link to the customer record (M3 edge case 4).

**States:**
- **Empty:** the entity has no contracted products. The tab shows "No products contracted yet. Products are added in the customer handoff (Sales) or with Add product line (Ops)."
- **Loading:** a skeleton band per product. Change controls stay disabled until data has loaded.
- **Error:** if loading fails, the tab shows "Onboarding data could not be loaded" with Retry. If saving fails, the dialog stays open with its values kept and shows "Stage not saved. Try again." The band keeps its previous stage.
- **Read-only for non-owners:** bands, badges, dates and the billing start indicator are visible. The Change stage, Mark as blocked and Resolve block buttons are not rendered. Sales sees only the target date as editable.

**Edge cases:**
1. Ops moves `EU VoP / NL` from `Testing & certification` back to `Sandbox & technical integration` after failed certification, then forward again two weeks later. The band shows the latest entry date, and History shows the backward and forward moves in order.
2. A product that is already at `Live & hypercare` moves back to `Go-live approval` because production keys were revoked. The billing start indicator is removed, and the lifecycle state returns to `Onboarding` if no other product is live.
3. Ops sets the entry date to a future date. Saving is blocked with "Entry date cannot be in the future".
4. A product blocked by `Partner` is moved to `BAU` with the block left open. The block stays visible and keeps appearing in the Ops worklist until it is resolved.
5. Two Ops users change the stage of the same product within seconds. The second save is rejected with a "Reload to see the latest stage" message.
6. The target go-live date is set earlier than the contract signing date recorded by Ops (M4 AC9). Saving is blocked with "Target go-live cannot be earlier than the contract signing date". When no contract reference exists yet, only the M3 AC3 rule applies.

**Out of scope (phase 2):**
- Email notifications to Finance or Sales on stage changes (F6, S8 reminders).
- Monthly realised volume compared with contracted volume during ramp-up (C8).
- Billing system link or automatic first-invoice trigger (F8, F9).
- Configurable stages per product or customer. The 9 stages are fixed in MVP.
- Read-only lock of Sales fields (including the target date) after handoff (S9).

---

### A.M7: Contacts with explicit roles

**Story (EN):** As a user from the team that owns the contact, I want to add contacts with an explicit role (champion, decision maker, technical, incident, escalation, billing), with email, phone, time zone, availability window and last verified date, and to have the incident contact appear first on a partner's record, so that during an outage we call the right person on the first try and notice in time when a champion leaves.

**Screens:** Entity record (screen 4): Contacts tab, header (incident contact block for partner entities), Overview tab (key people). New customer wizard (screen 3) step 3 (initial contacts, same rules). Home worklist (screen 1). History tab. Audit tab.

**Acceptance criteria:**

- **AC1: Role context.** Each contact belongs to one entity and one role context: `Customer` or `Partner`. The context selector appears only when the entity has both roles, and it defaults to the only role otherwise.
- **AC2: Contact role.** Each contact record has exactly one role: `Champion`, `Decision maker`, `Technical`, `Incident`, `Escalation`, `Billing`. A person who holds two roles gets two records. When the entered email matches an existing contact on the same entity, the form offers "Copy details from Marta Kovacs (Technical)".
- **AC3: Ownership by role.** The team allowed to create and edit a contact is:
  - `Champion`, `Decision maker` in Customer context: Sales and Customer Success. The ownership label always reads "Owned by Sales and Customer Success", because both teams edit these contacts (M15 AC3).
  - `Technical`, `Incident`, `Escalation` in Customer context: Ops.
  - Every role except `Billing` in Partner context (`Champion`, `Decision maker`, `Technical`, `Incident`, `Escalation`): Network. This matches M15 AC4.
  - `Billing`: Finance, in either context.
  All other teams see that contact read-only with its ownership label. The role dropdown in the Add contact form offers only the roles the current user's team owns.
- **AC4: Fields and validation.**
  - Full name: required, 2 to 120 characters.
  - Email: required, one `@`, a domain with at least one dot, no spaces, max 254 characters, stored in lowercase. Invalid input shows "Enter a valid email address".
  - Phone: required for `Incident` and `Escalation`, optional for the other roles. Spaces, hyphens, dots and brackets are removed before validation. The result must match E.164 (`+` followed by 8 to 15 digits, first digit 1 to 9, for example `+447700900123`) and is stored in that form. Invalid input shows "Use international format, for example +447700900123".
  - Time zone: an IANA identifier chosen from a searchable list (for example `Europe/London`, `Asia/Singapore`). Required for `Incident`, `Escalation` and `Technical`.
  - Availability window: either `24/7` or a set of weekdays plus a start and end time (HH:MM) in the contact's time zone. Required for `Incident` and `Escalation`.
  - Job title: optional, max 120 characters.
  - Status: `Active` (default) or `Left`.
  - Last verified: set automatically to today, with the verifying user, when the contact is created.
- **AC5: Re-verify.** Each active contact has the action "Mark as verified". Given a user from the owning team confirms it, then Last verified is set to today and Verified by is set to that user. Editing other fields leaves Last verified unchanged. The contact row shows "Verified 47 days ago by Lukas Brenner".
- **AC6: Mark as left.** Contacts have no delete action. The owning team uses "Mark as left", with a required leave date (no later than today) and an optional note. Left contacts move to the collapsed section "Former contacts (n)" and keep all their data.
- **AC7: Champion departure.** Given the last active `Champion` of a customer entity is marked as left, then the Overview shows the alert "No active champion since <date>". The entity appears in the Sales worklist (M11) as "Champion left" for the Sales user who created the entity.
- **AC8: Missing incident contact.** Given the last active `Incident` contact of a role context is about to be marked as left, then a confirmation warns "Lloyds Bank plc will have no active incident contact". After confirmation, the header (partner) or Overview (customer) shows "No active incident contact" as a critical (carmine) alert.
- **AC9: Primary incident contact.** Among the active `Incident` contacts of one role context, exactly one can be flagged `Primary`. Flagging one removes the flag from the previous primary. If no contact is flagged, the most recently verified one is treated as primary.
- **AC10: Partner header.** Given an entity has the partner role, then the record header shows the primary partner incident contact before any other header content below the entity name: name, phone as a `tel:` link with copy button, email as a `mailto:` link, time zone with current local time, availability window with "Available now" or "Outside availability", and Last verified. A link "All incident and escalation contacts" opens the Contacts tab filtered to those roles.
- **AC11: Ordering on the Contacts tab.** Contacts are grouped by role context, then by role in this order: Incident, Escalation, Technical, Champion, Decision maker, Billing. Inside a role, the Primary contact comes first, then the others by most recent Last verified.
- **AC12: Duplicate warning.** Given an active contact with the same email and same role already exists on the entity in the same context, then saving shows "Marta Kovacs is already an active Incident contact" and the user must confirm or cancel.
- **AC13: Worklists (M11).** Network worklist: active partner contacts with Last verified older than 90 days. Finance worklist: active `Billing` contacts with Last verified older than 6 months. Sales worklist: champions marked as left (AC7). Worklist rows are read-only. Each row opens the contact on the Contacts tab, where users of the owning team use "Mark as verified".
- **AC14: Audit.** Create, every field edit, Mark as verified, Primary flag change and Mark as left each write audit entries (object = Contact with name and role, field, old value, new value, user, team, date and time).
- **AC15: History timeline.** Events are created for: contact added, role-relevant field changed (phone, email, availability), marked as left, primary incident contact changed. Example: "Incident contact changed: Primary is now Paul Grant (was Marta Kovacs). By Lukas Brenner, Network." Mark as verified is recorded in the audit log only, which keeps the timeline readable.

**States:**
- **Empty:** "No contacts yet." Users from an owning team see "Add contact". For partner entities with no incident contact, the header shows "No active incident contact" as a critical (carmine) alert.
- **Loading:** a skeleton of the role groups. On partner records, a skeleton of the header incident block, which loads before the rest of the tab.
- **Error:** if loading fails, the tab shows "Contacts could not be loaded" with Retry. On partner records, the header shows "Incident contact unavailable. Retry." If saving fails, the form keeps its values and shows "Contact not saved. Try again."
- **Read-only for non-owners:** contacts the user's team does not own show without Edit, Mark as verified, Mark as left or Primary controls, with the label "Owned by Network" (or the relevant team). Phone and email links stay clickable for everyone.

**Edge cases:**
1. An incident contact at a Singapore partner has the window Mon to Fri 09:00 to 18:00 `Asia/Singapore`. A Bucharest Network user opens the record at 15:00 local time (20:00 in Singapore). The header shows "Local time 20:00, Outside availability" and the escalation contact is one click away.
2. An availability window ends earlier than it starts (22:00 to 06:00). It is treated as crossing midnight and is accepted.
3. Phone entered as `0044 7700 900123`. Validation fails because the number does not start with `+`, and the message suggests `+447700900123`.
4. Lloyds Bank plc is both customer and partner, and the same person is incident contact for both. Two records exist: one owned by Ops (Customer context) and one by Network (Partner context). Each is verified separately.
5. A CS user tries to add a `Billing` contact. The role is absent from the dropdown, and the tab shows "Billing contacts are owned by Finance".
6. A champion is marked as left by mistake. The owning team edits the status back to `Active`, which is logged in audit and History.

**Out of scope (phase 2):**
- Email reminders to re-verify contacts (N9, F4 reminders).
- Automatic detection of a champion's departure (for example from email bounces or LinkedIn).
- Bulk import of contacts.
- Hard delete of contacts and one-click restore from the audit log.
- Read-only lock of Sales-created contacts after handoff (S9).

---

### A.M8: Ops to Customer Success handoff

**Story (EN):** As an Onboarding Manager, I want to hand the customer over to Customer Success at the end of hypercare through a structured summary (stage of each product, open blocks, commitments to the customer, confirmed contacts) and to choose the CSM who becomes the owner, with the CSM confirming the takeover, so that the customer does not have to answer the same questions twice.

**Screens:** Handoff (screen 6): Ops to CS form and acceptance view. Entity record (screen 4): header (current owner, pending handoff banner), History tab. Home worklist (screen 1): "To pick up" for CS, "Awaiting acceptance" and "Handoff declined" for Ops. Audit tab.

**Acceptance criteria:**

- **AC1: Entry point.** The entity record shows the button "Hand over to Customer Success" to every Ops user when the entity has at least one customer product at `Ramp-up` or `BAU` and no open Ops to CS handoff, whoever the current owner is. When no product has reached `Ramp-up`, Ops users see the button disabled, with the tooltip "Available when at least one product has completed hypercare".
- **AC2: One open handoff.** Given an Ops to CS handoff with status `Sent` exists for the entity, then the button is replaced by the banner "Handoff to Emma Wilson pending since 01 Oct 2026" and a second handoff cannot be created.
- **AC3: Summary section 1, product stages (auto).** The form shows a snapshot of every customer product: product and country, current stage, stage entry date, billable from date. This section is read-only in the form and is captured as it stands at send time.
- **AC4: Summary section 2, open blocks (auto).** The form lists every open block (product, Blocked by, reason, blocked since). For each block Ops must enter a handoff note (max 300 characters) such as the next step or the owner of the next step. When no blocks are open, the section shows "No open blocks".
- **AC5: Summary section 3, commitments to the customer.** Ops enters one or more commitments. Each commitment has a description (5 to 300 characters) and an optional due date. An example is "Weekly status call until full UK CoP volume, due 30 Nov 2026". If there are none, Ops must tick "No open commitments". The section cannot be left empty.
- **AC6: Summary section 4, confirmed contacts.** The form lists every active customer-context contact with role, name, email, phone and Last verified. Ops must tick "Confirmed" on each contact owned by Ops (Technical, Incident, Escalation). Each ticked contact gets Last verified = today (as in M7 AC5), written inside the send transaction (AC9), so nothing changes if the send fails. Contacts owned by other teams show read-only with their Last verified date.
- **AC7: Contact rules at send.** Sending is blocked when the customer context has no active `Incident` contact ("Add an active incident contact before handing over"). When there is no active `Champion`, the form shows the warning "No active champion. The CSM will need to identify one", and Ops can still send.
- **AC8: Choose the CSM.** "Receiving CSM" is required, chosen from active users in the Customer Success team (M15). An optional "Note for the CSM" field accepts up to 1,000 characters.
- **AC9: Send.** When Ops selects "Send handoff", then a Handoff record is created with type `Ops → CS`, from (the sending Ops user), to (chosen CSM), the structured summary, status `Sent` and the sent date. The current owner stays unchanged until acceptance. The header shows the pending banner (AC2).
- **AC10: CSM sees it.** Given a handoff with status `Sent`, then it appears in the chosen CSM's Home worklist under "To pick up" with the entity name, sender, sent date and days pending. Opening it shows the read-only summary with "Accept" and "Decline".
- **AC11: Accept.** When the CSM selects "Accept", then status becomes `Accepted` with the acceptance date, the current owner becomes the CSM, and the header owner updates. `Champion` and `Decision maker` contacts keep the label "Owned by Sales and Customer Success" (M7 AC3). The item is removed from the CSM's "To pick up" and from the Ops "Awaiting acceptance" list.
- **AC12: Decline.** When the CSM selects "Decline", a reason (10 to 500 characters) is required. Status becomes `Declined`, and the owner stays unchanged. The handoff appears in the sender's worklist as "Handoff declined by Emma Wilson: <reason>". The button "Hand over to Customer Success" becomes available again. A new handoff starts with the previous block notes, commitments and note for the CSM prefilled, and with every contact "Confirmed" tick cleared.
- **AC13: No response.** A `Sent` handoff has no expiry and no automatic acceptance. It stays in the CSM's "To pick up" list and in the sender's "Awaiting acceptance" list, with days pending shown on both. After 2 business days, the item is highlighted in both lists (M11 AC10). Any Ops user can select "Cancel handoff", with a required reason of 10 to 500 characters (as for decline). This sets status `Cancelled` and allows a new handoff to another CSM.
- **AC14: Pending period.** While status is `Sent`, Ops keeps edit rights on all Ops data, and changes after send do not alter the summary snapshot. The CSM has read access to the full record from the moment the handoff is sent (as all teams do), and edit rights follow M15 roles.
- **AC15: Permissions.** Any Ops user can create or cancel an Ops to CS handoff. Only the chosen CSM can accept or decline it, and only while they are in the Customer Success team. Every other user sees the handoff read-only.
- **AC16: Audit.** Send, accept, decline and cancel each write audit entries: object = Handoff, field = status (old and new), plus owner change (old owner, new owner) on accept, with user, team, date and time.
- **AC17: History timeline.** Events: "Handoff to Customer Success sent to Emma Wilson by Adrian Koh", "Handoff accepted by Emma Wilson. Owner: Adrian Koh → Emma Wilson", "Handoff declined by Emma Wilson: <reason>", "Handoff cancelled by Adrian Koh: <reason>". Each event links to the read-only handoff summary, which stays available after acceptance.

**States:**
- **Empty:** the entity has no Ops to CS handoff. The History tab shows only the Sales to Ops handoff (M3), and the CSM's "To pick up" list shows "Nothing to pick up. Handoffs from Ops appear here."
- **Loading:** a skeleton of the four summary sections while product, block and contact data load. "Send handoff" stays disabled until loading completes.
- **Error:** if send fails, the form keeps every entered value and shows "Handoff not sent. Try again." No Handoff record is created. If accept or decline fails, status remains `Sent` and the message "Action not saved" appears.
- **Read-only for non-owners:** other teams, and CS users other than the chosen CSM, see the summary and status with no Accept, Decline or Cancel controls.

**Edge cases:**
1. Revolut Ltd has `UK CoP / GB` in `BAU` and `EU VoP / DE` still in `UAT`. The handoff is allowed. The summary shows `EU VoP / DE` in `UAT`, and Ops keeps updating its stage after acceptance (M6 permissions are by team).
2. The chosen CSM loses the Customer Success role (M15) while the handoff is `Sent`. The CSM loses Accept and Decline at once. The handoff shows "Recipient no longer in Customer Success" to the sender, and an Ops user cancels it and sends a new one.
3. Ops marks the only incident contact as left after sending. The snapshot stays as sent, and the record shows the live "No active incident contact" alert from M7.
4. The CSM declines with "Wrong region, Singapore accounts sit with Ethan Brooks". Ops resends to Ethan Brooks, and the prefilled commitments are carried over.
5. The entity is soft-deleted (M16) while a handoff is `Sent`. The handoff leaves both worklists, and Accept or Decline on an open handoff page fails with "This record was deleted. Contact the admin to reactivate it." If the admin reactivates the entity, the handoff returns with status `Sent`.

**Out of scope (phase 2):**
- Email notifications or reminders to the CSM or the sender about pending handoffs.
- Automatic escalation or auto-assignment when a handoff stays pending.
- Read-only lock of Sales fields after handoff (S9).
- Exporting the handoff summary.

---

### A.M9: Set and reassign the internal owner

**Story (EN):** As a Customer Success Manager, I want to set and reassign the customer's internal owner, with the reason and date saved automatically in the history and an in-portal notification for the new owner, so that every customer always has a named owner, including during leave and when people leave the company.

**Screens:**
- Entity record (screen 4), header: current owner, "Reassign owner" button, owner-assignment banner
- Entity record, History tab: the reassignment event
- Home: my worklist (screen 1): the "Ownership assigned to you" item

**Acceptance criteria:**

1. **AC1 Owner always visible.** Given any entity that is not soft-deleted, when any user opens the entity record, then the header owner block shows "Owner: <name>, <team>" (for example "Owner: Emma Wilson, Customer Success") and the date they became owner.
2. **AC2 No owner state.** Given an entity with no current owner (for example a seeded record), when any user opens it, then the header shows "No owner" with a warning style. Users with permission to set the owner see a "Set owner" button in place of "Reassign owner".
3. **AC3 Who can reassign.** Given a user whose team is Customer Success, when they open an entity record, then the "Reassign owner" (or "Set owner") button is visible and enabled. Given a user from Sales, Ops (including the admin), Network, Compliance or Finance, the button is hidden (M15 AC2 and AC3). The owner block stays visible. The text "Owned by Customer Success" moves to a tooltip in the place of the Reassign control, so it never reads as a label on the owner name.
4. **AC4 Server-side permission.** Given a user without permission, when they call the reassignment API directly, then the request is rejected with a 403 error and nothing changes.
5. **AC5 Reassign dialog.** Given a permitted user clicks "Reassign owner", then a dialog opens with:
   - current owner (read-only)
   - new owner: a searchable picker of active users from Customer Success, Ops/Onboarding and Sales, grouped by team with Customer Success first
   - reason: free text, required, 10 to 500 characters
   - effective date: read-only, set to today
   - "Cancel" and "Reassign" buttons
6. **AC6 Validation.**
   - Given the reason is empty or shorter than 10 characters, when the user clicks "Reassign", then the dialog stays open, shows "Reason is required (minimum 10 characters)" and saves nothing.
   - Given the selected new owner is the same as the current owner, then "Reassign" is disabled and the dialog shows "Select a different owner".
   - Inactive users never appear in the picker.
7. **AC7 Happy path.** Given Emma Wilson (CS) reassigns Adyen N.V. from Leo Martin to Sophie Mitchell with the reason "Leo on parental leave until February 2027", when she clicks "Reassign", then:
   - the header shows Sophie Mitchell as owner, effective today
   - a success toast reads "Owner changed to Sophie Mitchell"
   - the dialog closes
8. **AC8 Audit and history.** Given a successful reassignment, then one audit log entry is written: object = entity, field = owner, old value, new value, user, team, date and time, and the reason. The History tab shows an "Owner reassigned" event with previous owner, new owner, actor, timestamp and reason.
9. **AC9 In-portal notification.** Given a successful reassignment, then the new owner gets an "Ownership assigned to you" item in the Home worklist. The item shows the entity, previous owner, who reassigned it, date and reason. The Home navigation item shows a count badge of unacknowledged assignments. No email is sent.
10. **AC10 Acknowledgement.** Given the new owner has an unacknowledged assignment, when they open that entity, then the header shows a banner "You were assigned as owner on [date] by [name]: [reason]" with an "Acknowledge" button. When they click "Acknowledge" (on the banner or on the worklist item), then the item leaves their worklist, the badge count goes down by one, and the acknowledgement is written to the audit log.
11. **AC11 Consecutive reassignment.** Given an assignment that has not been acknowledged, when the entity is reassigned again to someone else, then the earlier recipient's item is removed and only the latest owner receives a new item.
12. **AC12 Handoffs keep owner semantics.** Given a `Sales → Ops` handoff is confirmed (M3) or an `Ops → CS` handoff is accepted (M8), then the owner changes to the receiving user and the History tab records it as a handoff event, separate from the M9 reassignment event. The M9 reason field does not apply to handoffs.

**States:**
- **Empty:** "No owner" header state (AC2). In the picker, if no active users match the search, it shows "No active users match".
- **Loading:** the header owner block shows a skeleton line. The picker shows a spinner while users load. While saving, the "Reassign" button shows a spinner and is disabled to prevent double submission.
- **Error:** if the save fails, the dialog stays open with the entered values kept and shows the error "Could not reassign owner. Try again." If the user list fails to load, the picker shows "Could not load users" with a "Retry" link.
- **Read-only:** for users without permission, the owner block ("Owner: <name>, <team>") and date are shown with no action button. In the "View as" demo selector, switching to a non-CS team hides the button immediately.

**Edge cases:**
1. **Concurrent edit.** Two CSMs open the dialog for UniCredit Bank GmbH and both submit. The second submission is rejected with "Owner was changed by [name] at [time]. Reload to see the current owner." No second audit entry is written.
2. **Owner account deactivated.** The current owner's user account is deactivated. The header still shows the name with an "Inactive user" label, and the reassign button stays available to CS. The inactive user does not appear in pickers.
3. **Pending handoff.** A handoff Ops → CS to Leo Martin has status "Sent" and a CSM reassigns the owner to Sophie Mitchell. The dialog warns "A handoff to Leo Martin is awaiting acceptance. If Leo accepts, he becomes owner." The reassignment saves, and the handoff stays pending.
4. **Self-assignment.** A CSM assigns themselves as owner. The system allows it, creates no worklist notification item for the actor, and still writes the audit entry and History event.
5. **Soft-deleted entity.** On a soft-deleted entity, reassignment is unavailable for all users, including admin, until the admin reactivates the record.

**Out of scope (phase 2):**
- Temporary cover ownership with automatic return to the original owner after leave
- Bulk reassignment of all entities owned by one user
- Email notifications to the new or previous owner
- Admin screens for managing users and the owner picker rules

---

### A.M10: Shared customer history with notes and timeline

**Story (EN):** As a user from any of the 6 teams, I want to add notes to the customer's shared history with a type (call, QBR, negotiation, incident, payment), participants, a summary and action items with an owner and due date, and to see a filterable timeline that automatically includes stage changes, contact changes, handoffs and reassignments, so that anyone who takes over the customer understands the context in a few minutes.

**Screens:**
- Entity record (screen 4), History tab: the timeline, the filters and the "Add note" form
- Entity record, Overview tab: the "Latest interactions" block (the 5 most recent History entries, notes and events, as in M1 AC14)

**Acceptance criteria:**

1. **AC1 Who can add notes.** Given a user from any of the 6 teams (Sales, Ops/Onboarding, CS, Network, Compliance, Finance), when they open the History tab of an entity that is not soft-deleted, then the "Add note" button is visible and enabled.
2. **AC2 Note form fields.**
   - **Type** (required, single select): Call, QBR, Negotiation, Incident, Payment, Other
   - **Interaction date** (required): defaults to today, cannot be in the future
   - **Participants** (optional, multi-select):
     - internal: active portal users
     - external: active contacts of this entity from the Contacts tab
     - free-text names for people not in the portal, up to 10
   - **Summary** (required): 20 to 5,000 characters, plain text with line breaks
   - **Action items** (optional, 0 to 20 rows). Each row has:
     - description (required, up to 300 characters)
     - owner (required, an active portal user)
     - due date (required, today or later when created)
     - status: Open by default
3. **AC3 Validation.**
   - Given a required field is missing or out of range, when the user clicks "Save note", then the form shows an inline message under each invalid field and saves nothing.
   - Given an action item row is partly filled, then all three row fields are required before saving, or the user removes the row.
4. **AC4 Happy path.** Given Tom Hadley (Sales) adds a "Negotiation" note on Lloyds Bank plc with participants Emma Wilson (internal) and James Holloway (champion contact), a summary, and an action item "Send revised volume tiers" owned by Tom Hadley, due 16 Oct 2026, when he saves, then:
   - the note appears at the top of the timeline with type, author, author team, interaction date, created timestamp, participants, summary and the action item
   - the Overview tab shows it in "Latest interactions"
5. **AC5 Automatic events.** Given changes recorded in the audit log, then the timeline shows read-only system events with actor name, actor team, timestamp and an old → new summary for:
   - **Stage change:** a product or scheme moves stage, is marked blocked (with blocked by and reason), or is unblocked (M6)
   - **Contact change:** a contact is added, changes role, email or phone, or is marked Left (M7)
   - **Handoff:** sent, confirmed, accepted, declined or cancelled, with type `Sales → Ops` or `Ops → CS` and a link to the handoff summary (M3, M8)
   - **Owner reassigned:** previous owner, new owner and reason (M9)
   - **Network and structure:** coverage status and connection method changes (M5), role, group and contract reference changes (M4), and "Record created" (M2 AC18)
   - **Other field changes:** every other audited field change, for example KYB or billing updates

   Links from an event to the audit details show only to Compliance and the admin. Other teams see the old and new values inline on the event.
6. **AC6 Event immutability.** Automatic events cannot be edited or deleted by any user. They show no edit control.
7. **AC7 Order and paging.** The timeline is sorted newest first. Notes use the created timestamp, and their interaction date is shown on the card. The timeline loads 50 items at a time with a "Load more" button.
8. **AC8 Filters.**
   - **Team** (multi-select): Sales, Ops/Onboarding, CS, Network, Compliance, Finance. This is the author's team for notes and the actor's team for events.
   - **Event type** (multi-select): Call, QBR, Negotiation, Incident, Payment, Other, Stage change, Contact change, Handoff, Owner reassigned, Network and structure, Other field changes.
   - Within one filter, values combine with OR. Across filters, they combine with AND.
   - By default all teams and all event types are selected, including "Network and structure", except "Other field changes", which is off, so the timeline stays readable.
   - A "Reset filters" link restores the defaults. Filter selections persist for the user within the browser session.
9. **AC9 Open action items filter.** A toggle "Open action items only" shows only notes that have at least one Open action item. Action items whose due date has passed and that are still Open show an "Overdue" label.
10. **AC10 Action item status.**
    - Given an action item, when the note author or the action item owner clicks its checkbox, then the status toggles between Open and Done.
    - The change records who changed it and when, and is written to the audit log.
    - Status changes are allowed at any time, independent of the note edit window.
    - Other users see the status as read-only.
11. **AC11 Note edit window (decision).**
    - The author can edit a note's type, interaction date, participants, summary and action items for 24 hours after creation. After 24 hours the note is read-only for everyone, including the author and admin.
    - Edited notes show "Edited [date, time]". Each edit writes old and new values to the audit log.
    - **Rationale:** the History tab is evidence for due diligence and for handoffs (problems 4 and 9), so its content must stay stable. A 24-hour window lets authors fix typos and missing participants on the same day.
    - To correct an older note, the user adds a new note.
12. **AC12 No deletion.** No user can delete a note in MVP. The note card shows no delete control.

**States:**
- **Empty:** for an entity with no notes and no events, the timeline shows "No history yet. Add the first note to start the shared history." with the "Add note" button. When filters return nothing, it shows "No items match these filters" with "Reset filters".
- **Loading:** three skeleton cards while the timeline loads. "Load more" shows a spinner while it fetches.
- **Error:** if the timeline fails to load, it shows "Could not load history" with "Retry". If a save fails, the form stays open with the input kept and shows "Note not saved. Try again."
- **Read-only:** notes past the 24-hour window, notes by other authors, and all automatic events show no edit control. On a soft-deleted entity, the History tab is read-only for all users and "Add note" is hidden.

**Edge cases:**
1. **Window boundary.** The author opens the edit form at 23h58m after creation and saves at 24h01m. The save is rejected with "The edit window for this note has closed" and the note stays unchanged.
2. **Inactive action item owner.** The owner of an action item is deactivated. The item keeps their name with an "Inactive user" label, and the note author can still mark it Done.
3. **Participant contact marked as left.** An external participant contact is later marked as left on the Contacts tab (M7 AC6). The note keeps the participant's name as it was at save time, shown with a "Former contact" label.
4. **Group links.** A note is added on Santander UK plc. It appears only on that entity's timeline, and the other Santander group entities show nothing. Group-level aggregated timelines are out of scope.
5. **Burst of stage events.** Many stage changes are saved in quick succession, for example an Ops user moving a product through two stages in one minute. Each change appears as its own event, in order, with no merging.

**Out of scope (phase 2):**
- Email or automatic reminders for action item due dates
- A cross-entity "My action items" list
- Deleting notes or restoring them from the audit log
- Attachments on notes
- Group-level aggregated timeline
- Export of the history

---

### A.M11: Personal worklist per team

**Story (EN):** As a user from any of the 6 teams, I want a personal worklist adapted to my team (Ops: days in stage, blockers, go-lives in 14 days, empty required fields; CS: renewals in 120 days; Compliance: licences, LEIs and reviews expiring in 30, 60, 90 days; Network and Finance: contacts not verified for more than 90 days and 6 months respectively; Sales: champions who left and passed go-lives at the customers I brought in), so that I start the day with the actions that matter and stop tracking in calendars and spreadsheets.

**Screens:**
- Home: my worklist (screen 1)
- Every item links to the matching entity record tab (screen 4): Details, Products & onboarding, Contacts, Compliance, Billing, or the Handoff screen (screen 6)
- "View as" demo selector

**Acceptance criteria:**

1. **AC1 Default landing page.** Given a logged-in user, when they open the portal, then Home shows the worklist for their team. Each rule is its own section, with a title and an item count. Items are sorted with Overdue first. Date-based rules then sort by the soonest date. Elapsed-time rules (Blocked, Too long in current stage, Champion left) sort by the longest elapsed time first.
2. **AC2 Computed and current.** Worklists are computed from current data each time Home loads, with no stored list. "Today" is the current date in Europe/Bucharest, and all comparisons are date-only. "Business days" means Monday to Friday, with no holiday calendar in the MVP.
3. **AC3 Scope selector.**
   - The default scope is "Mine" for every team.
   - For Ops and CS: a "Mine / My team" toggle. Mine covers entities where the user is the current owner, plus handoffs addressed to the user or sent by the user. "My team" covers the same items for every user of the same team.
   - After CS accepts an Ops to CS handoff, the Ops items on that entity (blocks, go-lives, stage thresholds) show for every Ops user under "My team", and under "Mine" for the Ops user who sent the handoff.
   - For Sales: the scope is entities the user created (M2) and the Sales → Ops handoffs the user sent.
   - For Compliance, Network and Finance: Mine covers all entities. These teams hold no per-entity ownership.
4. **AC4 Item content.** Every item shows:
   - entity name and country
   - the rule label
   - the key value with its date, for example "Licence expires in 23 days (25 Oct 2026)"
   - a status chip: Overdue, ≤30 days, 31-60 days or 61-90 days, plus 91-120 days for CS renewals, where relevant
   - an "Open" link to the exact tab and field

**Ops / Onboarding sections**

5. **AC5 To pick up and sender lists.**
   - **To pick up:** `Sales → Ops` handoffs with status "Sent" addressed to the user. The item shows the sender, the sent date and the days waiting. After 2 business days the item moves to the top and is marked "Waiting <n> days" (M3 AC18). **Leaves when:** the user confirms pickup (status Confirmed), or Sales changes the recipient.
   - **Awaiting acceptance:** `Ops → CS` handoffs with status "Sent" that the user sent, with the CSM, sent date and days pending. After 2 business days the item is highlighted (M8 AC13). **Leaves when:** the CSM accepts or declines, or an Ops user cancels (M8 AC15).
   - **Handoff declined:** `Ops → CS` handoffs that the user sent and the CSM declined, shown as "Handoff declined by <CSM>: <reason>" (M8 AC12). **Leaves when:** the user sends a new handoff for that entity.
6. **AC6 Too long in current stage.** A product or scheme whose days in current stage is above the threshold:
   - stages Contract signed through Go-live approval: more than 21 days
   - stage Live & hypercare: more than 56 days

   The thresholds are configuration constants, with no admin screen in MVP. Ramp-up and BAU are excluded. **Leaves when:** the stage changes, which resets the stage entry date.
7. **AC7 Blocked.** Every product or scheme with the blocked flag set. The item shows blocked by (Customer, Corvane, Partner), the reason and the days blocked. **Leaves when:** the blocked flag is cleared.
8. **AC8 Go-lives in the next 14 days.** A product or scheme with a target go-live date from today to today + 14, inclusive, and a current stage before Live & hypercare. **Leaves when:** the stage reaches Live & hypercare, or the target date moves outside the window.
9. **AC9 Required fields empty.** An entity that has a customer role and at least one product in stages Contract signed through Live & hypercare, where any of these is empty:
   - LEI
   - entity type
   - country
   - an applicable contract (M4)
   - at least one active Technical contact
   - at least one active Incident contact
   - a target go-live date on every product before Live & hypercare
   - a group decision: a group or "Standalone entity" confirmed (M4 AC15, shown as "Group not set")

   An applicable contract that is missing shows as "No contract attached" (M4 AC15). The item lists the missing fields by name. **Leaves when:** all listed fields are filled.

**Customer Success sections**

10. **AC10 To pick up.** `Ops → CS` handoffs with status "Sent" addressed to the user. After 2 business days the item is highlighted (M8 AC13). **Leaves when:** accepted, declined or cancelled.
11. **AC11 Renewals in the next 120 days.** A customer role with a renewal date from today to today + 120, plus renewal dates already passed, labelled "Renewal date passed". Chips: Overdue, ≤30 days, 31-60 days, 61-90 days and 91-120 days. **Leaves when:** the renewal date is updated to a date more than 120 days away.
12. **AC12 Ownership assigned to you.** The M9 notification item. **Leaves when:** acknowledged (M9 AC10). This section also appears for Ops and Sales users who receive an assignment.

**Compliance sections**

13. **AC13 KYB and review expiries.**
    - Licence KYB checks by expiry date
    - LEI KYB checks by the GLEIF next renewal date. The item reads the LEI KYB check (M12 AC3), which shows the GLEIF status of the entity LEI. An LEI with GLEIF status LAPSED or any status M2 AC7 marks invalid (RETIRED, MERGED, ANNULLED, DUPLICATE) shows as Overdue, for example Banco Santander Consumer Portugal S.A.
    - periodic reviews by next review date

    Each is grouped into Overdue (date before today), ≤30 days, 31-60 days and 61-90 days. Items beyond 90 days are excluded. **Leaves when:** the expiry or next review date is updated to more than 90 days away, or the GLEIF status returns to ISSUED.

**Network section**

14. **AC14 Partner contacts not verified for 90+ days.** Active contacts on entities with a partner role, owned by Network, where the last verified date is more than 90 days before today or empty. Empty dates are shown as "Never verified" and sorted first. **Leaves when:** the last verified date is updated, or the contact is marked Left.

**Finance sections**

15. **AC15 Billing contacts not verified for 6+ months.** Active contacts with role Billing where the last verified date is more than 6 calendar months before today or empty. **Leaves when:** verified or marked Left.
16. **AC16 Incomplete billing profiles.** Entities whose billing profile has the "Incomplete for billing" flag (M14 AC11). The item lists the missing or invalid fields. This section is an exception to the AC1 sort: items are sorted by the number of missing or invalid fields, most first. **Leaves when:** the flag clears.

**Sales sections**

17. **AC17 Champion left.** Entities created by the user where a Champion contact has status Left and no active Champion contact exists. **Leaves when:** an active Champion contact is added to that entity, or a Left champion is set back to Active (M7 edge case 6). There is no separate "Champion reassigned" item.
18. **AC18 Overdue go-lives.** Products on entities created by the user with a target go-live date before today and a current stage before Live & hypercare. The item shows the days late. **Leaves when:** the stage reaches Live & hypercare, or the target date is moved to today or later.

**Common rules**

19. **AC19 No manual dismiss.** Items cannot be dismissed or snoozed. They leave only when the underlying data changes, or by acknowledgement for M9 items.
20. **AC20 Refresh after action.** Given the user resolves an item on the entity record and returns to Home, then the item is gone without a manual page reload.
21. **AC21 Excluded entities.** Soft-deleted entities and entities with lifecycle state Inactive never appear in any worklist.
22. **AC22 No email.** Worklists are in-portal only. No email or push notification is sent.
23. **AC23 View as.** Given the demo "View as" selector is set to a team, then Home shows that team's sections and edit rights immediately, opened on the "Mine" scope. Ops and CS also show the "My team" toggle.
24. **AC24 Awaiting pickup (Sales).** `Sales → Ops` handoffs with status "Sent" that the user sent, with the Onboarding Manager, sent date and days waiting. After 2 business days the item is highlighted. **Leaves when:** the Onboarding Manager confirms the pickup. When Sales changes the recipient, the item stays and shows the new Onboarding Manager.
25. **AC25 Rows are read-only.** Worklist rows have no inline actions, including "Mark as verified". The one exception is "Acknowledge" on "Ownership assigned to you" rows (M9 AC10). Each row opens the exact tab where the action happens, for example the Contacts tab for a stale contact (M7 AC13).

**States:**
- **Empty:** a section with zero items stays visible in collapsed form, showing "Nothing to do here". If every section is empty, Home shows "Your worklist is clear" plus a link to Search.
- **Loading:** a skeleton row per section while the sections load independently, so that a slow section does not block the others.
- **Error:** a section that fails to compute shows "Could not load this list" with "Retry". Other sections still render.
- **Read-only:** worklist items are read-only views. Every action happens on the linked tab, where normal edit permissions apply. A user who opens an item outside their editing area sees the target fields with the owning team label.

**Edge cases:**
1. **Several triggers on one product.** A product is both blocked and over its stage threshold. It appears once in each section. Each item leaves independently when its own rule stops matching.
2. **LEI lapsed and near renewal.** An LEI with GLEIF status LAPSED that also has a renewal date 20 days ahead appears once, as Overdue, with the label "LEI lapsed in GLEIF".
3. **Exactly at the boundary.** A licence that expires exactly 30 days from today is in the ≤30 days group. A go-live exactly 14 days ahead is included. A contact verified exactly 90 days ago is excluded from the 90+ days rule, which starts at 91 days.
4. **Partner and customer at once.** An entity that is both partner and customer has a stale incident contact owned by Network. It appears in the Network list only. Ops required-field rules consider only Ops-owned Technical and Incident contacts.
5. **Inactive creator.** A Sales user who created an entity is deactivated. Their Sales items stop showing because nobody sees that list. The Ops and CS rules for the entity keep working.
6. **No owner.** An entity has no owner. Its Ops and CS items appear only in the "My team" scope.

**Out of scope (phase 2):**
- Email notifications and automatic reminders
- Snooze and dismiss
- Configurable thresholds per user or team through an admin screen
- A "My action items" section from History notes
- Actual versus contracted volume signals and churn signals
- Generated list of customers affected by a partner incident

---

### A.M12: KYB verification and periodic review

**Story (EN):** As a Compliance Officer, I want to fill in the KYB fields (licence and issuing authority, LEI with its GLEIF status, ownership structure, sanctions screening result), each with who verified it, when, and a link to the source document, plus the status and dates of the periodic review, so that during an audit I can show what we verified, when, by whom and based on which documents.

**Screens:**
- Entity record (screen 4), Compliance tab: the KYB section and the Periodic review section
- Entity record, Overview tab: active alerts
- Entity record, Audit tab: the change log
- Home: the Compliance worklist (M11 AC13)

**Acceptance criteria:**

1. **AC1 KYB layout.** Given any entity (customer, partner or both), when a user opens the Compliance tab, then the KYB section shows four check cards: Licence, LEI, Ownership structure and Sanctions screening. Each card shows:
   - its fields
   - a computed status chip: Not started, Verified, Expiring (≤90 days), Expired
   - verified by
   - verified on
   - expiry date, where applicable
   - the evidence link
2. **AC2 Licence check.**
   - licence number: required, up to 50 characters
   - issuing authority: required, up to 120 characters, for example "Bank of England, PRA"
   - expiry date: required, unless "No expiry date" is ticked
3. **AC3 LEI check.**
   - The LEI value is read from the entity record (M2). Ops corrects it on the Details tab (M1 AC20).
   - GLEIF status and next renewal date are filled from GLEIF and are read-only.
   - "Refresh from GLEIF" fetches the current values and records the fetch time.
   - The expiry date of this check equals the GLEIF next renewal date.
4. **AC4 Ownership structure check.**
   - summary: required, up to 2,000 characters, for example "Parent: UniCredit S.p.A., 99.9%. UBO: none above 25%." for UniCredit Bank GmbH
   - parent entity name: optional
   - This check has no expiry date and is re-verified at the periodic review.
5. **AC5 Sanctions screening check.**
   - result (required): No match, Potential match under review, or Confirmed match
   - lists or provider screened: required, up to 200 characters
   - This check has no expiry date and is re-verified at the periodic review.
6. **AC6 Verification metadata.**
   - Given a Compliance user saves a check, then "verified by" is set automatically to the current user and cannot be edited.
   - "Verified on" defaults to today, is editable, and cannot be in the future or after the expiry date.
   - The evidence link is required.
7. **AC7 Evidence link validation.**
   - Given an evidence link, when the user saves, then the URL must start with https:// and its host must be on the configured approved-storage list. For the demo this is docs.corvane-internal.example.
   - Otherwise the field shows "Use a link to approved document storage" and nothing is saved.
   - The link opens in a new tab for all users. Access to the document itself is governed by the storage system.
8. **AC8 Computed check status.**
   - **Not started:** no verification is saved.
   - **Verified:** saved, with expiry more than 90 days away or no expiry.
   - **Expiring:** expiry from today to today + 90.
   - **Expired:** expiry before today, or LEI GLEIF status LAPSED or any status M2 AC7 marks invalid (RETIRED, MERGED, ANNULLED, DUPLICATE).
9. **AC9 Happy path.** Given Mei Chen (Compliance) records the Licence check on Adyen N.V. with licence number "DNB-BL-0412", issuing authority "De Nederlandsche Bank", expiry 31 Mar 2028, verified on 02 Oct 2026, and an evidence link on approved storage, when she saves, then:
   - the card shows status Verified, "Verified by Mei Chen on 02 Oct 2026" and the link
   - a success toast confirms the save
10. **AC10 Re-verification keeps history.**
    - Given a saved check, when a Compliance user updates any field, then the card shows the new values.
    - The audit log keeps every old and new value with user and timestamp, so earlier verifications stay provable.
    - "Verified by" and "verified on" update to the new verification.
11. **AC11 Periodic review fields.**
    - status: Planned, In progress, Completed or Overdue
    - last review date
    - next review date: required once the status is set
12. **AC12 Review status rules.**
    - Overdue is set automatically when the next review date is before today and the status is Planned or In progress. Users cannot select Overdue manually.
    - When a user moves the review from Overdue to In progress, the Overdue label is kept as a secondary "Past due" marker until the review is Completed.
    - To set Completed, the user enters a completion date. It becomes the last review date, cannot be in the future, and requires a new next review date later than it.
    - After saving Completed, the status becomes Planned for the new next review date. A "Completed [date]" line shows the last cycle.
13. **AC13 Permissions.**
    - Only users on the Compliance team can create or edit KYB checks and periodic review fields. The API rejects other users with 403.
    - All other teams, including the admin, see the Compliance tab read-only, with the label "Owned by Compliance".
    - Evidence links are clickable for all teams.
14. **AC14 Audit logging.**
    - Every create and update of a KYB field or review field writes an audit log entry: object, field, old value, new value, user, team, date and time. It is visible in the Audit tab to Compliance and admin.
    - These changes also appear in History under "Other field changes" (M10 AC5).
    - GLEIF refreshes are logged with "System (GLEIF)" as the source and the requesting user.
15. **AC15 Overview alerts.**
    - Given any check is Expired or Expiring, or the sanctions result is "Potential match under review" or "Confirmed match", or the review is Overdue, then the Overview tab "Active alerts" block lists it with a link to the Compliance tab.
    - No automatic suspension or other action follows.
16. **AC16 Same fields for partners.** A partner-only entity shows the same four KYB checks and the same periodic review fields as a customer.

**States:**
- **Empty:** each card in Not started state shows "Not verified yet". Compliance users also see a "Record verification" button. The Periodic review section shows "No review scheduled" and, for Compliance users, "Schedule review".
- **Loading:** skeleton cards while the tab loads. "Refresh from GLEIF" shows a spinner and is disabled while the request runs.
- **Error:**
  - Save failures keep the input and show "Not saved. Try again."
  - If GLEIF is unavailable, the LEI card keeps the last known status and fetch time and shows "GLEIF unavailable, showing data from [date, time]".
  - If the LEI is not found in GLEIF, it shows "LEI not found in GLEIF" and the status chip becomes Expired.
- **Read-only:** non-Compliance users see all values, chips, dates and links with the "Owned by Compliance" label, and no edit, record or refresh controls. Soft-deleted entities are read-only for everyone.

**Edge cases:**
1. **Missing LEI.** A seeded legacy record has no LEI (records created through M2 always have one, M2 AC2). The LEI card shows "No LEI on this entity" with a link to the Details tab, where Ops enters or corrects the entity LEI (M1 AC20). The GLEIF refresh is disabled, and the card status is Not started.
2. **Expired licence date entered.** A Compliance user enters a licence expiry date before today. The save is allowed because it records reality, and the card immediately shows Expired. The item appears in the Compliance worklist as Overdue.
3. **Licence without expiry.** A licence with "No expiry date" ticked never appears in expiry worklists. It still shows Verified with verified on and the evidence link.
4. **Confirmed sanctions match.** A sanctions result changes from No match to Confirmed match. The audit log shows both values and the user. The Overview alert appears for all teams, and no other system behaviour changes in MVP.
5. **Review already late at creation.** A user schedules a review with a next review date that has already passed. The status saves as Overdue at once and the item appears in the Compliance worklist.
6. **Evidence storage moves.** The approved-storage domain list changes and an existing link points to a host that is no longer approved. The link stays visible with a "Link outside approved storage" warning. The next edit requires an approved link.

**Out of scope (phase 2):**
- Automatic sanctions screening and ownership monitoring
- Uploading documents into the portal (MVP stores links only)
- Review frequency rules based on risk rating
- CSV export of the audit log for auditors
- Email reminders for expiries and reviews
- Restoring a previous KYB value from the audit log in one click

---

### A.M13: Key contractual obligations per customer and partner agreement

**Story (EN):** As a Compliance Officer, I want to record the key obligations for every customer, and for every agreement with a partner (incident notification time in hours, subprocessor change notice in days, audit right, availability SLA, VoP or CoP scheme status, agreement expiry date), and to filter customers by subprocessor notice days, so that we apply the correct deadlines during incidents and supplier changes without opening the contract PDFs.

**Screens:**
- Entity page > Compliance tab, "Contractual obligations" section, with one card per role: "Customer agreement" and "Partner agreement".
- Search & results, "Obligations" view. This is a column set and filter set added to the existing results list.
- Entity page > Audit tab, as the place where obligation changes are recorded (see M16).

**Acceptance criteria:**

AC1. **One obligation set per role.** Given an entity with a customer role, the Compliance tab shows a "Customer agreement" card. Given an entity with a partner role, it shows a "Partner agreement" card. An entity with both roles, for example "Lloyds Bank plc", shows both cards, and each card is stored separately.

AC2. **Fields and validation.** Every card holds exactly these fields:

| Field | Type | Validation | Example |
|---|---|---|---|
| Incident notification time | integer, hours | 1 to 720, whole numbers only | 4 |
| Subprocessor change notice | integer, days | 0 to 365, whole numbers only. 0 displays as "No advance notice required" | 60 |
| Audit right | Yes / No | single choice | Yes |
| Availability SLA | percentage | 90.00 to 100.00, at most 2 decimals | 99.95 |
| EU VoP status | enum | Not applicable, Not started, In progress, Adhered, Suspended, Withdrawn | Adhered |
| UK CoP status | enum | same values as EU VoP | Not applicable |
| Agreement expiry date | date | valid calendar date in ISO format; a past date is allowed | 2028-03-31 |
| Contract PDF link | URL | must start with `https://` and point to an approved host; 2,048 characters maximum | https://docs.corvane-internal.example/lloyds-msa.pdf |

AC3. **Partial capture is allowed.** Every field is optional at save time. An empty field displays "Not captured". Each card shows a counter in the form "6 of 8 captured".

AC4. **Field errors block the save.** Given a Compliance user enters "4.5" in Incident notification time, when they click Save, then the save is blocked, the field shows "Enter a whole number of hours between 1 and 720", and every other field keeps the value the user typed.

AC5. **Compliance edits.** Given the current user is on the Compliance team, when they open either card, then an "Edit" button appears. Saving writes one audit entry per changed field (M16) and refreshes the "Last updated by Mei Chen (Compliance), 02 Oct 2026 14:05" line on that card.

AC6. **Everyone else reads.** Given the current user is on the Network, Sales, Ops, CS or Finance team, then both cards render read-only with the label "Owned by Compliance" and no Edit button. This includes Network on the Partner agreement card.

AC7. **Expiry badge.**
- An expiry date in the past shows the badge "Expired".
- An expiry date 90 days away or less shows "Expires in N days".
- Otherwise no badge appears.

The badge appears only on the card and in the Obligations view. It does not add an item to any worklist.

AC8. **Contract link.** When the user clicks the Contract PDF link, the URL opens in a new browser tab. The portal stores only the URL. It does not upload or store the file.

AC9. **Obligations view: one row per role.** Given any user is on Search & results, when they switch to the "Obligations" view, then the list shows one row per obligation set. An entity with both roles appears on two rows. The columns are:
- Entity
- Country
- Role (Customer / Partner)
- Incident notice (h)
- Subprocessor notice (d)
- Audit right
- SLA %
- EU VoP
- UK CoP
- Expiry
- Contract link

AC10. **Numeric filters.**
- The view offers "Subprocessor notice (days)" with min and max inputs.
- The view offers "Incident notice (hours)" with min and max inputs.
- Both filters combine with the existing M1 filters (country, scheme, role, stage, partner coverage status, owner) using AND.
- The Obligations view lives in Search (screen 2). In this view the scheme filter matches the scheme status fields on the obligations card (EU VoP status, UK CoP status): scheme = UK CoP returns rows whose UK CoP status is anything other than "Not applicable".
- The partner coverage status filter returns Partner rows of entities with at least one coverage row in that status. Scenario 2 uses it to list the agreements of partners with Degraded coverage.

Example: given Role = Customer and Subprocessor notice min = 30, the list shows only customer rows with a value of 30 or more.

AC11. **Rows without a value.** Rows where a filtered field is empty are excluded whenever that numeric filter is active. Each numeric filter has a separate checkbox, "Only rows where this is not captured", so Compliance can find gaps. Turning that checkbox on disables the min and max inputs.

AC12. **Sorting.**
- The Subprocessor notice and Incident notice columns sort ascending and descending.
- Empty values always sort last.
- The default sort in the Obligations view is Subprocessor notice, descending.

AC13. **Filter results.**
- The result count updates with every filter change, for example "14 agreements".
- Filters and sort are kept in the URL query string, so a filtered list can be shared by link.

AC14. **Server-side check.** When a non-Compliance user calls the obligations update API directly, the server returns 403 and changes nothing (see M15 AC9).

**States:**
- **Empty (entity):** the role card shows "No obligations captured yet". Compliance sees an "Add obligations" button. Other teams see "Owned by Compliance".
- **Empty (list):** "No agreements match these filters", with a "Clear filters" link.
- **Loading:** a skeleton card on the tab and skeleton rows in the list. The filters stay usable.
- **Error:** on load, show "Couldn't load obligations. Retry". On save, show a banner "Changes not saved. Try again", keep the user's typed values in the form, and write nothing to the audit log.
- **Read-only:** all fields render as text with the "Owned by Compliance" label, and the Edit buttons are hidden.

**Edge cases:**
1. **Notice of zero days.** "Monzo Bank Ltd" has Subprocessor notice = 0. With filter min = 0 it appears and displays "No advance notice required". With min = 1 it is excluded.
2. **Role added later.** A partner role is added to "Santander UK plc" after the customer card was filled. An empty Partner agreement card appears. The customer values are not copied into it.
3. **Role removed.** When a role is removed from an entity, its obligation set is kept and hidden from the tab and the list. It reappears unchanged when that role is restored. The removal itself is recorded in the audit log.
4. **Soft-deleted entity.** Rows belonging to a soft-deleted entity (M16) never appear in the Obligations view.
5. **Different statuses can co-exist.** The EU VoP status here is Compliance's contractual and scheme status. It can differ from the M5 partner coverage status, for example Adhered here and Degraded in coverage. Both are shown, each with its own owner label, and neither field updates the other.
6. **Availability SLA in two places.** The Customer agreement card's Availability SLA (owned by Compliance, the contractual value) and the promised availability % in the M3 handoff summary (owned by Sales) are separate fields with their own owners. Both use 2 decimals, and neither field updates the other.

**Out of scope (phase 2):**
- Subprocessor change notification generator with deadlines (CO7).
- Generated list of customers affected by a partner incident (N6).
- Full obligations register beyond the key fields listed above, including response-time SLAs and other negotiated clauses.
- Uploading or storing contract PDFs inside the portal.
- Email reminders for agreement expiry, and expiry items in worklists.
- CSV export of the Obligations view.

---

### A.M14: Billing profile and "Incomplete for billing" flag

**Story (EN):** As a Finance specialist, I want to record the billing data for every entity (legal name, address, VAT code, LEI) and the Corvane entity that signed the contract, with the contract reference, and the portal to flag the entity as "incomplete for billing" until the data is complete and valid in format, so that I issue the invoice from the correct Corvane entity to the correct entity and reduce rejected invoices.

**Screens:**
- Entity page > Billing tab.
- Entity page header, for the flag badge.
- Home: My worklist, Finance view, "Incomplete billing profiles" section.
- Entity page > Audit tab (M16).

**Acceptance criteria:**

AC1. **Billing profile fields.** The billing profile belongs to one legal entity and has these fields:

| Field | Validation |
|---|---|
| Billing legal name | 2 to 200 characters. Pre-filled from the entity's legal name (GLEIF) when the profile is first opened, and editable. |
| Billing address: street | 1 to 200 characters |
| Billing address: city | 1 to 100 characters |
| Billing address: postal code | 1 to 20 characters |
| Billing address: country | ISO 3166-1 country picker |
| VAT / tax ID | see AC2 |
| LEI | see AC3 |
| Contracting Corvane entity | single choice from a fixed configured list: "Corvane Singapore Pte. Ltd.", "Corvane Europe B.V.". Free text is not possible. |
| Contract reference | Read-only on the Billing tab, labelled "Owned by Ops". It shows the contract ID of the applicable contract on the Customer role (M4 AC9). Finance does not enter it. |

AC2. **VAT / tax ID format.**
- Spaces, dots and hyphens are stripped on save, and the value is stored in upper case.
- If the billing country is an EU member state, the value must start with that country's VAT prefix (Greece uses `EL`), followed by 2 to 12 letters or digits.
- For any other country, the value must be 4 to 20 letters or digits.
- No online check (VIES) is performed.

AC3. **LEI format.**
- Exactly 20 characters, matching `[A-Z0-9]{18}[0-9]{2}`, and passing the ISO 17442 mod 97-10 check digit test.
- The value is pre-filled from the entity's LEI.

AC4. **Format errors block the save.** Given a Finance user enters an invalid value, when they click Save, then the save is blocked, the field shows a specific message, and the other values are kept in the form. Example message: "LEI must be 20 characters and pass the check digit test".

AC5. **Partial profiles can be saved.** Finance can save a profile where some fields are still empty. Empty required fields are listed under the flag described in AC7.

AC6. **Who the flag applies to.** The flag is computed only for entities that meet all four conditions:
- the entity has a customer role,
- its lifecycle state is not Inactive,
- it is not soft-deleted,
- it is its own invoiced entity. An entity invoiced through another entity follows AC15.

For an entity with only a partner role, the Billing tab shows the profile as optional, with the note "Billing profile not required: partner role only", and no flag is computed.

AC7. **The flag rule.** For an entity covered by AC6, "Incomplete for billing" = true when one or more of these 9 required fields is empty, or holds a value that fails the AC2 or AC3 format rules:
- Billing legal name
- Street
- City
- Postal code
- Country
- VAT / tax ID
- LEI
- Contracting Corvane entity
- Contract reference

The flag is computed at read time and is never stored. Values that reached the database without passing the save check, for example demo seed data, are still re-checked for format.

AC8. **Missing and invalid fields are named on the Billing tab.** Given the flag is true, the Billing tab shows a banner such as "Incomplete for billing. Missing: VAT / tax ID, Contract reference. Invalid format: LEI". Each named field is highlighted, and clicking a field name scrolls to that field. A missing contract reference shows the hint "Ops attaches the contract on the Customer role" with a link to the Customer role card on the Details tab (M1 AC20), and the item also appears on the Ops worklist "Required fields empty" as "No contract attached" (M4 AC15).

AC9. **Header badge.** Given the flag is true, the entity header shows an amber badge "Incomplete for billing" to every team. The tooltip lists the same missing and invalid fields as AC8. Clicking the badge opens the Billing tab.

AC10. **Badge clears immediately.** When Finance saves the last missing value, the badge disappears from the header and the banner disappears from the tab, with no page reload.

AC11. **Finance worklist.**
- When "View as" is Finance, the Home worklist shows the section "Incomplete billing profiles (N)".
- Each row shows: entity name, country, contracting Corvane entity (or "Not set"), and the number of missing or invalid fields.
- Rows are sorted by the number of missing or invalid fields, most first (M11 AC16).
- Clicking a row opens that entity's Billing tab.
- An entity leaves this list as soon as its flag becomes false.

AC12. **Who edits.** Only Finance users see the Edit button on the Billing tab. All other teams see the profile read-only with the label "Owned by Finance". The server rejects updates from other teams with 403 (M15 AC9).

AC13. **Billing contact reference.** The Billing tab shows active contacts with the role Billing, read-only, with a link to the Contacts tab (M7). Billing contacts do not count toward the flag rule.

AC14. **Audit.** Every save writes one audit entry per changed field (M16).

AC15. **Billed through another entity.** Given the applicable contract names another group entity as invoiced entity (M4 AC9), then the Billing tab shows "Billed through <entity>" with a link to that entity's Billing tab, the profile fields stay optional, and no "Incomplete for billing" flag, badge or worklist item appears. Example: Santander UK plc shows "Billed through Banco Santander Totta, S.A.".

**States:**
- **Empty:** "No billing profile yet". For an entity covered by AC6, the header badge is shown, the tab lists all 9 fields as missing, and Finance sees a "Create billing profile" button.
- **Loading:** a skeleton form. The header badge waits for the profile to load and is never shown in a provisional state.
- **Error:** on load, show "Couldn't load billing profile. Retry". On save, keep the typed values and show "Changes not saved".
- **Read-only:** values render as text with the "Owned by Finance" label. The missing and invalid list is still visible, so other teams can see what Finance is waiting for.

**Edge cases:**
1. **Group entities are billed separately.** "Banco Santander Totta, S.A." (PT) and "Santander Consumer Bank S.p.A." (IT) belong to the same group and are each invoiced directly. Each needs its own billing profile, and completing one does not clear the flag on the other.
2. **LEI differs from the entity LEI.** If the billing LEI differs from the entity's LEI, a non-blocking warning appears. Example: Finance enters the group parent LEI 5493006QMFDDMYWIAM13 on the profile of Banco Santander Totta, S.A., and the field shows "Differs from entity LEI 549300URJH9VSI58CS32". The flag is unaffected, because the format is valid.
3. **VAT prefix does not match the country.** A billing country of Germany with the VAT value `NL123456789B01` fails AC2, and the save shows "VAT ID must start with DE for Germany".
4. **Lapsed LEI.** The entity's GLEIF LEI status is Lapsed. The flag still checks format only. The Lapsed status stays visible in the header (M2).
5. **Removed Corvane entity option.** If a configured contracting Corvane entity is later removed from the list, existing profiles keep the stored value and show it with the note "No longer in list". The flag treats this field as invalid until Finance picks a current value.

**Out of scope (phase 2):**
- Link to and sync with the billing system, and contract-to-invoice reconciliation (F8, F9).
- Online VAT validation (VIES) and GLEIF re-check of the billing LEI.
- Monthly realised volume compared with contracted volume (C8).
- Email reminders for incomplete profiles.

---

### A.M15: Predefined roles and field ownership

**Story (EN):** As the portal administrator, I want to assign each colleague one of the predefined roles, so that each team edits only its own data area, everyone else sees it read-only, and Corvane can answer due diligence questions about access control with documentation.

**Screens:**
- Admin > Users & roles. This is a minimal admin screen inside the approved MVP screen 7, with a "Change history" panel.
- Admin > Roles & permissions, read-only (screen 7).
- Every entity page tab.
- New customer wizard.
- Handoff screen.
- The "View as" switcher, demo only.

**Acceptance criteria:**

AC1. **Six roles.** The six roles are Sales, Ops, CS, Network, Compliance and Finance. Every user has exactly one role. Roles are fixed in code, and the UI cannot create, rename or delete them.

AC2. **Admin flag.**
- The admin flag is a separate yes/no attribute on a user.
- In the MVP exactly one user holds it, and that user is on the Ops team: "Adrian Koh (Ops, admin)".
- The admin flag is set in seed or configuration data and appears read-only on the Users & roles screen.
- The admin flag grants these things: Admin > Users & roles, Admin > Deleted records, Admin > Roles & permissions, the entity Audit tab and, when `DEMO_MODE` is on, "Reset demo data" (M16 AC16).
- The admin flag does not grant edit rights in other teams' data areas.

AC3. **Ownership matrix.** The server enforces this matrix. E = edit, R = read.

| Data area | Sales | Ops | CS | Network | Compliance | Finance |
|---|---|---|---|---|---|---|
| Entity core (legal name, aliases, type, country, LEI, BICs, roles Customer and Network partner), group links and the Inactive lifecycle state. The other lifecycle states are computed (M6 AC12) | E at creation in the wizard, then R | E | R | R | R | R |
| Customer role: handoff summary (promised SLAs, special terms) | E (stays editable in MVP) | R | R | R | R | R |
| Customer role: commercial terms (price per verification, volume tiers, monthly minimum, payment term) | E | R | R | R | R | E |
| Customer role: applicable contract per entity | R | E | R | R | R | R |
| Customer role: renewal date | R | R | E | R | R | R |
| Current owner reassignment (M9) | R | R | E | R | R | R |
| Handoffs | E: send `Sales → Ops`, change its recipient while Sent | E: confirm `Sales → Ops`, send and cancel `Ops → CS` | E: accept or decline `Ops → CS` | R | R | R |
| Partner role and coverage (connection method, provider, country and scheme status) | R | R | R | E | R | R |
| Partner role: partner agreement reference (M4 AC11) | R | E | R | R | R | R |
| Contracted products (product, country, target go-live date, with a reason on every change) | E | E | R | R | R | R |
| Onboarding stages, stage dates, blockers | R | E | R | R | R | R |
| Contacts: champion, decision maker (Customer context) | E | R | E | R | R | R |
| Contacts: technical, incident, escalation (Customer context) | R | E | R | R | R | R |
| Contacts in the Partner context, every role except billing | R | R | R | E | R | R |
| Contacts: billing | R | R | R | R | R | E |
| KYB, periodic review, contractual obligations | R | R | R | R | E | R |
| Billing profile | R | R | R | R | R | E |
| Notes in History | add | add | add | add | add | add |
| Audit tab | hidden | hidden (visible to the admin) | hidden | hidden | R | hidden |
| Roles & permissions page (read-only) | hidden | hidden (visible to the admin) | hidden | hidden | R | hidden |
| Users & roles, soft delete, reactivation, "Reset demo data" (`DEMO_MODE` only) | none | admin only | none | none | none | none |

AC4. **Contact ownership.**
- Each contact stores its owning team. The owning team is set automatically from the contact role, following AC3.
- Partner contacts are created on the Contacts tab with the Partner role context (M7 AC1). A contact in the Partner context is owned by Network, whatever its contact role, except Billing contacts, which Finance owns in either context (M7 AC3).
- Edit rights on a contact follow the owning team.

AC5. **Assigning a role.** Given the admin opens Admin > Users & roles, the screen shows a table with columns Name, Email, Team and Admin, which can be searched by name or email. When the admin changes "Michael Reed" from Sales to Finance and confirms the dialog "Change Michael Reed's team from Sales to Finance? His edit rights change immediately.", then:
- the change is saved,
- one audit entry is written: object User, field Team, old Sales, new Finance, the admin as actor,
- the change appears in the "Change history" panel (AC14),
- Michael's next request is evaluated with Finance rights.

AC6. **Adding a user.** The admin can add a user with name, email and team. All three fields are required, the email must be valid, and an email can belong to only one user. A duplicate email shows "A user with this email already exists".

AC7. **Read-only rendering.** Given the user lacks edit rights on a section:
- The section renders as plain text with a lock icon.
- The section header shows the label "Owned by <team>", for example "Owned by Compliance".
- Edit, Add and Delete controls for that section are not rendered.
- Fields stay selectable, so users can copy values.

AC8. **Mixed ownership within a tab.** When ownership is mixed inside one tab, the label appears per section or per field group. Example: on the Contacts tab, the Incident group shows "Owned by Ops" while the Billing group shows "Owned by Finance".

AC9. **Server-side enforcement.** Every write endpoint checks the user's team against AC3 before writing. Given a Sales user sends a PATCH to a KYB record, then:
- the server returns 403 with `{"error":"forbidden","owner_team":"Compliance"}`,
- nothing is written to the database or to the audit log.

UI visibility is never the only check.

AC10. **Rights that change mid-session.** Given a user's rights changed after the page loaded (for example, the admin moved them to another team) and they press Save, the server returns 403. The UI then:
- shows the toast "You can't edit this. Owned by Compliance. Your team: Sales.",
- discards the unsaved values for that section,
- re-renders the section read-only.

AC11. **"View as" switcher (demo).**
- The switcher has six options. Each option signs the session in as one seeded demo user of that team:
  - Sales = "Tom Hadley"
  - Ops = "Adrian Koh", the admin
  - CS = "Emma Wilson"
  - Network = "Lukas Brenner"
  - Compliance = "Mei Chen"
  - Finance = "Rachel Wong"
- Switching reloads the current page with that user's rights, worklist and visible tabs.
- Every action taken while impersonating is checked by the server and audited as the impersonated user and team.
- The switcher is shown only when the `DEMO_MODE` setting is on.
- When the new user cannot see the current page, the app opens Home with the toast "You don't have access to that page as <team>".
- Sign-in: in production, users sign in with the company SSO. In the demo, the session signs in automatically as the "View as" user. Session expiry is out of scope.

AC12. **Admin menu visibility.** The Admin menu entry is visible to the user with the admin flag, with Users & roles, Deleted records and Roles & permissions. Compliance users also see the Admin menu, with Roles & permissions only. In the demo, this means when "View as" is Ops or Compliance.

AC13. **Roles & permissions page.** Given a Compliance user or the admin opens Admin > Roles & permissions, then the page shows the AC3 matrix read-only: one row per data area, one column per team, with E, R, add, hidden or none in each cell. The page is generated from the same matrix definition the server enforces in AC9, so the two cannot differ. It has no edit controls. Other teams do not see the page, and its API returns 403 for them. Scenario 3 shows it live.

AC14. **Team change history.** Admin > Users & roles has a "Change history" panel listing every team change and every added user, newest first: user, old team, new team, changed by, date and time. The panel reads the User audit entries of AC5 and is read-only.

**States:**
- **Empty:** Users & roles with no users other than the admin shows "Only you have access. Add a colleague." The Change history panel with no changes shows "No team changes yet".
- **Loading:** skeleton table rows.
- **Error:** if a save fails, the team dropdown reverts to the previous value and shows "Couldn't change team. Try again". A 403 on any entity section follows AC10.
- **Read-only:** as AC7 and AC8. A non-admin who opens an Admin page they cannot access sees "You don't have access to Admin. Ask Adrian Koh (Ops)." Compliance users can open Roles & permissions only.

**Edge cases:**
1. **Admin changes their own team.** The admin tries to change their own team away from Ops. This is blocked with "The admin must stay on the Ops team in this version."
2. **Two teams edit the same field.** Sales and Finance edit commercial terms on the same customer role within the same minute. The last save wins, and both edits appear in the audit log in order.
3. **Moving a user does not move their contacts.** A CS user is moved to Network. Contacts that user created keep their owning team (CS), and the user immediately loses edit rights on them.
4. **Partner role removed.** For a contact owned by Network on an entity whose partner role is later removed, the owning team stays Network until a Network user changes the contact role.
5. **Wizard entry for non-Sales users.** A non-Sales user opens the New customer wizard URL. Only Sales can create entities, so the wizard shows "Only Sales can create a customer record" with a link to search (M2 AC1).

**Out of scope (phase 2):**
- Full admin screens, including the data quality owner role and the Ops lead role.
- Locking Sales fields as read-only after the handoff, with a correction request (S9).
- More than one admin, and managing the admin flag in the UI.
- Custom roles and per-field permission editing.
- User deactivation and offboarding flows. Session expiry.
- An access review report export for due diligence.

---

### A.M16: Audit log and recoverable soft delete

**Story (EN):** As a Compliance Officer, I want to see the full change log of every record (field, old value, new value, user, date and time), and a deleted record to remain recoverable by the admin, so that I can prove who changed what and a mistake does not permanently erase a customer's data.

**Screens:**
- Entity page > Audit tab.
- Entity page header menu: "Delete record", for the admin only.
- Admin > Deleted records.
- The banner on a deleted entity page.
- Search & results and Home: My worklist, which exclude deleted entities.

**Acceptance criteria:**

AC1. **When entries are written.** Every create, update, soft delete and reactivation of any object linked to an entity writes one audit entry per changed field. This covers the entity, roles, coverage, products, contacts, KYB, reviews, obligations, billing profile, handoffs, owner and notes. Each entry is written in the same database transaction as the change. If the change fails, no entry is written.

AC2. **What each entry records:**
- object type and label, for example "Contact: Priya Nair (Incident)",
- field,
- old value,
- new value,
- user name,
- user team at the time of the change,
- timestamp, stored in UTC and displayed in the viewer's local time with the UTC offset,
- entity ID and name.

On a create, the old value shows "(none)". On a removal, the new value shows "(removed)".

AC3. **Entries are immutable.**
- No API endpoint updates or deletes audit entries.
- The database user the application runs as has insert and select rights only on the audit table.
- The Audit tab offers no edit or delete controls.

AC4. **Who can see the Audit tab.** The Audit tab is visible to Compliance users and the admin. For all other teams the tab is not rendered, and `GET /api/entities/{id}/audit` returns 403.

AC5. **Order and pagination.** Entries are listed newest first, 50 per page, with "Load more".

AC6. **Filters.**
- Field: multi-select of the fields that appear in this entity's log.
- User: multi-select.
- Date range: from and to, inclusive, in local dates.
- Filters combine with AND. "Clear filters" resets them. The count shows, for example, "23 changes".

AC7. **Long values.** A value longer than 200 characters is truncated in the row, with an "Expand" link that shows the full text.

AC8. **Soft delete is admin-only.** Given the admin opens an entity, "Delete record" appears in the header menu. For all other users it is not rendered, and the API returns 403.

AC9. **Reason is mandatory.** When the admin clicks "Delete record", a dialog asks for a reason of 10 to 500 characters. "Delete" stays disabled until the reason is valid. On confirm:
- the entity is marked deleted, with deleted by, deleted at and the reason,
- one audit entry is written: field Record status, old Active, new Deleted, with the reason.

AC10. **What a soft delete hides.** A deleted entity and all its child data are hidden from:
- search results,
- every worklist,
- the Obligations view (M13),
- group page lists,
- the "To pick up" handoff list.

No child data is removed or changed in the database.

AC11. **Opening a deleted entity by URL.**
- A non-admin user sees "This record was deleted on 02 Oct 2026. Contact the admin, Adrian Koh, if it should be restored." No entity data is shown.
- The admin sees the full record read-only, with the red banner "Deleted by Adrian Koh on 02 Oct 2026. Reason: Duplicate of Lloyds Bank plc (LEI H7FNTJ4851HG0EXQ1Z70)" and a "Reactivate" button.
- No one can edit a deleted record.

AC12. **Admin > Deleted records list.**
- Columns: entity name, LEI, country, roles, deleted by, deleted at, reason.
- Default sort: deleted at, newest first.
- Search by name or LEI.
- Each row has a "Reactivate" button.

AC13. **Reactivation.** When the admin clicks Reactivate and confirms "Reactivate Monzo Bank Ltd? All its data returns to search and worklists.", then:
- the deleted marker is cleared,
- the entity and all child data reappear exactly as they were before deletion, including pending handoffs, owner, products and stages,
- one audit entry is written: field Record status, old Deleted, new Active, user, timestamp.

The reason for the original deletion stays visible in the Audit tab.

AC14. **Hard delete does not exist.** No user or endpoint can permanently delete an entity, and no such endpoint exists.

AC15. **Reactivation with an LEI conflict.** Given the LEI of the deleted record now belongs to another active entity (for example Sales created a new record after the M2 warning, edge case 3), when the admin clicks Reactivate, then the dialog shows the duplicate warning with the active record (legal name, country, owner, "Open record") and requires a reason of 10 to 500 characters. On confirm, both records stay active, the reason is written to the audit log and to History on the reactivated record, and the admin resolves the duplicate afterwards.

AC16. **Reset demo data (`DEMO_MODE` only).** Given `DEMO_MODE` is on, the admin sees "Reset demo data" in the Admin menu. The dialog asks "Reset all demo data? Every change made since the last reset is lost." On confirm, the portal reloads the seed data set, recalculates every seed date as an offset from today, and returns every user to Home. The action does not exist when `DEMO_MODE` is off, and its endpoint returns 404 there. It is the only path that removes audit entries, and it runs only on demo data.

**States:**
- **Empty:** the Audit tab with no entries shows "No changes recorded yet". With filters active it shows "No changes match these filters". Deleted records with no rows shows "No deleted records".
- **Loading:** skeleton rows on the Audit tab and on Deleted records.
- **Error:**
  - Audit tab load failure shows "Couldn't load the audit log. Retry".
  - A failed delete or reactivate leaves the record in its previous state and shows "Action not completed. Try again".
- **Read-only:** the Audit tab is always read-only for everyone. A deleted entity is read-only for the admin.

**Edge cases:**
1. **Quick successive saves.** Ops changes the stage of 3 products in 3 separate saves within one minute (M6 has one dialog per product). This writes 3 entries with the same user, one per product, in save order.
2. **Impersonation.** Changes made through "View as" Compliance are logged as "Mei Chen, Compliance", the impersonated demo user.
3. **Duplicate warning and deleted records.** The duplicate warning (M2) also checks deleted records. A new customer whose LEI matches a deleted entity shows "A deleted record with this LEI exists. Ask the admin to reactivate it.", and Sales can still continue creating the record.
4. **Deleting one group member.** Deleting one entity in a group hides only that entity. The group and its other entities stay visible, and the group page shows "1 deleted entity (visible to admin)".
5. **Team changes are not rewritten.** A user whose team later changes keeps the team recorded on each past entry. Past entries are never rewritten.
6. **Deleting the owner's records.** Deleting an entity owned by a CSM removes it from that CSM's worklist immediately. Reactivation restores the same owner and does not re-send the portal notification.

**Out of scope (phase 2):**
- One-click restore of a field value from the audit log (O12).
- CSV export of the audit log (CO8).
- Merging duplicate records (O5).
- Hard delete and data retention rules.
- Email notifications on deletion or reactivation.
- Logging read access or denied attempts.

---

---

## Appendix B. Acceptance criteria (M17 to M27)

### B.0 Source: acceptance criteria document

Binding acceptance criteria for the issue flow, as Appendix A is for M1 to M16. Copied verbatim from 20_acceptance_criteria_issue_flow.md (5 October 2026); decisions B15 to B38 of section 1.6 apply to it, and section 7.6.12 maps its release split to milestones.

**Status:** draft for Product Owner review, 5 October 2026.
**Scope:** stories M17 to M27 from 19_issue_flow_utilizatori_stories.md. M24 (escalation) is phase 2 and has no criteria here. Each story has: Story, Screens, Acceptance criteria, Release split, States, Edge cases, Out of scope.
**Use:** source for the Claude Design brief and the Claude Code build brief. These criteria extend 11_acceptance_criteria.md (M1 to M16); its shared conventions still apply. The UI and these criteria are in English, British spelling.

### B. Issue flow conventions (apply to M17 to M27)

**Principle:** at every moment an issue has exactly one owner, one communicator and one visible deadline. Customer Hub computes who does what and by when. People decide and act.

#### Roles on an issue

| Role | What they do | Who plays it | What they can edit |
|---|---|---|---|
| Reporter | Records the issue on the affected entity | Any user of the 6 teams, or "Monitoring (automatic)" | Description until acknowledged; notes at any time |
| Owner | Acknowledges, investigates, resolves, writes the root cause | Set by routing (below) | Type, severity, status, contributors, root cause, reassignment within the owner team |
| Communicator | The single voice to the affected entity: notifies, sends updates, closes with the customer | The customer owner (M9): Sales until Ops pickup, Ops during onboarding, Customer Success from Ramp-up. On a partner-only entity: the issue owner (Network). Out of hours on Sev-1: the on-call person (below) | Communication log, close, reopen |
| Contributor | Helps the owner with their team's knowledge | Default contributor by type, or added by the owner from any team | Notes |
| Compliance | Assesses possible major incident or possible data breach | Compliance team | Assessment and its clocks |

Everyone can view every issue and add notes. The server enforces these rights and returns 403 on any write outside them (M15). Escalation to the admin ("At risk", M24) is phase 2.

#### Issue types and owner teams (UI names are exact)

| Type | Examples | Owner team | Default contributor |
|---|---|---|---|
| Service unavailable or latency | Timeouts, responses above 5 seconds, API errors | Ops | none |
| Partner degraded or unavailable | A partner bank does not answer | Network | Ops |
| Wrong match result | "No match" on trading names, diacritics | Ops | Network |
| Integration blocker | Certificates, sandbox, EDS | Ops | none |
| Billing | Disputed invoice, wrong invoiced entity | Finance | Sales |
| Possible data breach or security | Unauthorised access, data loss | Compliance | Ops |
| Commercial or coverage | Missing country or scheme, terms | Sales | Network |
| Other | | Ops | none |

#### Severity

| Severity | When | Acknowledge within |
|---|---|---|
| Sev-1 | Service down or severely degraded; partner down with several customers affected; possible data breach | 15 minutes |
| Sev-2 | Service partly degraded, a workaround exists | 1 hour |
| Sev-3 | Limited impact, one isolated case | 1 business day |
| Sev-4 | Question or request | 3 business days |

**Proposed severity** from the report: impact "Down" gives Sev-1, "Degraded" gives Sev-2, "Isolated case" gives Sev-3, "Question or request" gives Sev-4. Billing and Commercial or coverage issues are capped at Sev-2 (their teams have no on-call). "Possible data breach = Yes" always gives Sev-1 and overrides every cap, including the before-go-live cap: a breach carries a legal duty at any stage. The owner can change severity with a reason.

**Before go-live:** if the affected product line is at Contract signed, Kickoff, Sandbox & technical integration, Testing & certification, UAT or Go-live approval, the maximum severity is Sev-3 and no notification clock starts. From Live & hypercare the full rules apply. With no product line selected, the most advanced stage among the entity's product lines on the selected scheme and country decides.

#### Statuses (exact names)

New (not yet acknowledged), In progress, Waiting on customer, Waiting on partner, Resolved, Closed. Reopen returns a Closed issue to In progress. An issue counts as open in every status except Closed: a Resolved issue stays open until the communicator closes it with the customer (open issues chip, Issues tab "Open" filter, similar issues block).

#### Business hours, on-call and routing (PO decisions, 5 October 2026)

**Business hours** are Monday to Friday, 09:00 to 18:00, in the local time zone below. No holiday calendar in the MVP.

| Team | Time zone |
|---|---|
| Ops | Asia/Kuala_Lumpur (UTC+8), one location |
| Network, Compliance, Finance | Asia/Singapore (UTC+8), head office |
| Sales, Customer Success | Each user's own time zone |

Seeded user time zones: Tom Hadley, Emma Wilson, Leo Martin and Ethan Brooks Europe/Amsterdam; Sophie Mitchell Europe/London; Michael Reed America/New_York. Ops, Network, Compliance and Finance users take their team's time zone. "Business days" for an acknowledge target are counted in the owner's business hours.

**Issue team per customer:** every entity has a named person per team for issues: the customer owner (M9), the Sales person (the Sales user who created the record; if that user is inactive, the Sales Director Tom Hadley), plus one person each from Ops, Network, Finance and Compliance. Seeded; shown on the entity record; editing it is phase 2. Seed defaults where the seed names nobody: Ops Adrian Koh (Revolut Ltd: Kevin Lim), Network Lukas Brenner, Compliance Mei Chen, Finance Rachel Wong.

**On-call:** Ops, Network and Compliance each have one on-call person at any time, from a seeded rota (editing the rota is phase 2). Sales and Finance have no on-call: their issue types are capped at Sev-2, and only a possible data breach makes them Sev-1 (rule 3). Seeded on-call this week: Ops Kevin Lim, Network Nora Lee, Compliance Mei Chen.

**Routing rules, applied automatically on save. There is no manual assignment at creation:**
1. The type gives the owner team.
2. Inside business hours of the owner team: the owner is the entity's named person in that team. With no named person, the team's on-call person.
3. Outside business hours, Sev-1: the owner is the owner team's on-call person, who is also the communicator until the customer owner's business hours start. Then communication passes automatically to the customer owner, with a system note summarising what was already communicated. Ownership stays with the on-call person, who can reassign it. Sales and Finance have no on-call: a Billing or Commercial or coverage issue that a possible data breach makes Sev-1 outside business hours goes to the Compliance on-call person as owner (the type stays unchanged), who is also the communicator until the customer owner's business hours start; the entity's named Finance or Sales person is added as contributor.
3b. Sev-1 while the customer owner is outside their own business hours (even when the owner team is in hours): the issue owner is also the communicator until the customer owner's business hours start, then communication passes to the customer owner as in rule 3.
4. Outside business hours, Sev-2 to Sev-4: the issue goes to the named person and appears in their worklist at the start of the owner team's next business hours. All clocks of that issue start at that moment. The communicator can still record a notification earlier.
5. The default contributor is the entity's named person in the contributor team.
6. Absence ("Absent until") and backup routing are Release 2.
7. Partner issues: on a "Partner degraded or unavailable" issue the communicator towards the partner is the issue owner (Network), also when the partner is a customer too (Lloyds Bank plc). Linked customer issues (M23) inherit the parent's owner and need no separate acknowledgement; each has its own communicator (that customer's owner) and its own notification deadline from that customer's contract.
8. Reporting on a group creates one linked issue per selected entity.

#### Clocks

| Clock | Starts | Stops | Target |
|---|---|---|---|
| Acknowledge | On save (or at business-hours start, rule 4) | "Acknowledge" | By severity (table above) |
| Customer notification (Sev-1, Sev-2) | At "Corvane aware at" time (or rule 4) | Communicator records a notification | Sev-1: Incident notification time from the Customer agreement card (M13), in elapsed hours. No value: 2 hours, with the label "Default deadline: the contract has no notification time". Sev-2: 4 business hours of the communicator |
| Facts for the customer's regulator (R2) | Compliance records "Possible major incident" | Communicator records "Facts pack sent" | "Facts needed within (hours)" on the Customer agreement card (M26). No value: no countdown, a red "Facts deadline not captured" |
| Data breach notification | Compliance records "Possible data breach" | Communicator records the breach notification | Without undue delay; internal target 24 hours. Rule label from the Corvane signing entity (M14): GDPR for Corvane Europe B.V., PDPA for the Singapore entity |
| Update | After each notification or update | Next update recorded | Sev-1 every 2 hours, Sev-2 every 8 hours |
| Compliance assessment | Issue flagged for Compliance | Assessment recorded | 1 hour on Sev-1 |

If severity goes up, deadlines are recalculated from "Corvane aware at". If it goes down before notification, the notification clock stays visible until a notification is recorded. Business-day targets: 1 business day = 9 business hours of the owner (Sev-4: 27). "Remind customer" (R2) is a step for the communicator. Auto-close after 5 business days in Waiting on customer, and auto-close of a Resolved issue with no customer reply after 5 business days, are both R2. Clock text formats: "Acknowledge in 9 min", "Notify customer in 1h 20m", "Update due now", "Overdue by 25 min" (red). Clocks are computed on the server from the demo clock (`src/lib/dates.ts`). Times display in the viewer's time zone with its abbreviation from a fixed map (CET/CEST, EET/EEST, WET/WEST, GMT/BST, MYT, SGT, EST/EDT), for example "21:12 CEST". Seed times are stored as local times in the stated zone and converted.

**US alert:** if a customer with regulatory regime "United States" has a service interruption of 4 hours or more, the issue shows "Interruption ≥4h at a US-regulated customer: notify immediately". It is not a deadline.

#### Message template (PO decision, 5 October 2026)

The communicator gets a prefilled first notification: subject "[Corvane] <Severity> incident <issue ID>: <product> <scheme> <country>"; body with entity name, affected product, scheme and country, Corvane aware at, impact, current status, next update time, issue ID and the communicator's name. Two buttons: "Copy message" and "Open in Gmail" (opens a Gmail compose window with recipient = the entity's incident contact email, subject and body prefilled). Nothing is sent by Customer Hub. The communicator then records the notification. Sending through the Gmail API is phase 2.

#### Issue IDs and seed issues

Issue IDs read "ISS-" followed by four digits. The seed holds these issues (times are offsets from the demo day):
1. **ISS-1042**, reporter "Monitoring (automatic)", the previous evening at 21:12 Europe/Amsterdam time (early morning in Kuala Lumpur, outside Ops hours): Service unavailable or latency, Sev-1, Banca Monte dei Paschi di Siena S.p.A., EU VoP, IT. Routed to the Ops on-call person, Kevin Lim, as owner and communicator. Kevin acknowledged it at 21:21 CEST and recorded the first notification at 22:05 CEST, by email to the MPS incident contact, Silvia Moretti. Compliance (on-call Mei Chen) recorded "Possible major incident" at 21:58 CEST. Status In progress. At Emma Wilson's business-hours start (09:00 CEST on the demo day) the communication passed to her with a system note. Shows night routing in the demo.
2. **ISS-1038**, reporter Adrian Koh: Wrong match result, Sev-2, Revolut Ltd, UK CoP, GB, In progress, owner Kevin Lim (Revolut's named Ops person), contributor Lukas Brenner, communicator Adrian Koh (Revolut's customer owner, Ops during onboarding). When scenario 1 hands Revolut over to Emma Wilson, the communicator becomes Emma automatically (M9 link).
3. **ISS-1031**, reporter Rachel Wong: Billing, Sev-3, UniCredit Bank GmbH, In progress, owner Rachel Wong, contributor Tom Hadley, communicator Emma Wilson.
The Lloyds Bank plc partner issue is created live in scenario 2 and is not seeded. In the seed, the customers with a live product line (Live & hypercare, Ramp-up or BAU) on UK CoP, GB are Santander UK plc (BAU, owner Sophie Mitchell), Lloyds Bank plc as customer (BAU, owner Adrian Koh) and Revolut Ltd (Live & hypercare, owner Adrian Koh). Zopa Bank Limited is on UK CoP, GB at UAT, so it is excluded (before go-live). These are the affected customers in M23.

#### Seed values for the regulatory block (M26)

| Customer | Regulatory regime | Facts needed within (hours) |
|---|---|---|
| Banca Monte dei Paschi di Siena S.p.A. | EU DORA | 2 |
| Santander UK plc | UK FCA | 4 |
| Lloyds Bank plc | UK FCA | 4 |
| Revolut Ltd | UK FCA | 4 |
| UniCredit Bank GmbH | EU DORA | 2 |
| Adyen N.V. | EU DORA | 2 |
| Monzo Bank Ltd | not captured | not captured |

### B. Decisions applied (5 October 2026)

The PM decisions below answer the open questions raised by the three authors. Every story in this file applies them.

- Possible data breach = Yes always gives Sev-1 and overrides every severity cap, including the cap before go-live.
- Billing and Commercial or coverage issues are capped at Sev-2.
- A possible data breach reported outside business hours on a Billing or Commercial or coverage issue goes to the Compliance on-call person as owner (the type stays unchanged), who is also the communicator until the customer owner's business hours start (rule 3); the entity's named Finance or Sales person is added as contributor.
- The issue team per customer includes a Sales person: the Sales user who created the record, with Tom Hadley as fallback.
- Seed defaults for the issue team where the seed names nobody: Network Lukas Brenner, Compliance Mei Chen, Finance Rachel Wong.
- Routing rule 3b: on a Sev-1 while the customer owner is outside their business hours, the issue owner communicates until those hours start.
- Routing rule 7: Network communicates with the partner on a partner issue, also for Lloyds Bank plc.
- Routing rule 7: linked customer issues inherit the parent's owner and need no separate acknowledgement.
- Routing rule 7: each linked customer issue has its own communicator and its own notification deadline from that customer's contract.
- Routing rule 8: a report on a group creates one linked issue per selected entity.
- The Sev-2 customer notification target is 4 business hours of the communicator.
- The facts clock is Release 2 and shows "Facts deadline not captured" in red when the card has no value.
- 1 business day = 9 business hours (Sev-4: 27).
- "Remind customer" is the communicator's step, in Release 2.
- Both automatic closes (Waiting on customer, and Resolved with no customer reply) are Release 2.
- Time zone abbreviations come from a fixed map: CET/CEST, EET/EEST, WET/WEST, GMT/BST, MYT, SGT, EST/EDT.
- ISS-1042 is seeded at 21:12 Europe/Amsterdam local time (21:12 CEST, 03:12 MYT), acknowledged by Kevin Lim at 21:21 CEST, with the Compliance assessment recorded at 21:58 CEST and the first notification recorded at 22:05 CEST by email to the MPS incident contact; status In progress; communication handed over to Emma Wilson at 09:00 CEST with the system note.
- The regulatory block of M26 uses the seed table of the conventions.

Worked examples assume the demo day is Monday 05 Oct 2026. Europe/Amsterdam and Europe/Rome are on CEST (UTC+2), Europe/London on BST (UTC+1), Kuala Lumpur (MYT) and Singapore (SGT) on UTC+8. Example issue IDs after ISS-1042 (ISS-1043, ISS-1044, ISS-1049 to ISS-1053) are illustrative and follow the order of the examples.

### B. Acceptance criteria by story

### B.M17: Report an issue on the affected entity

**Story (EN):** As a user from any of the 6 teams, I want to report an issue on the record of the affected entity (on a group, I choose the entities), with the type, the product, scheme and country, the description, the time Corvane became aware, the person at the customer who reported it, the impact and whether it is a possible data breach, and to see the issues already open on the same entity, scheme and country so I can add my report to an existing one, with the portal proposing the severity, so that the problem is recorded once, in the customer's context.

**Screens:**
- Entity record (screen 4), "Issues" tab: the list of the entity's issues and the "Report issue" button. The same button appears in the entity header.
- Group record (M4): "Report issue" button, which opens the same form with an entity picker.
- "Report issue" form (side panel over the entity or group record).
- Issue page: the record created on save (header, roles, clocks, History). M18 describes what it shows right after saving.
- Entity record, History tab: the "Incident" events (M10).

**Acceptance criteria:**

AC1. **Who can report.** Given a user from Sales, Ops / Onboarding, Customer Success, Network, Compliance or Finance, including the admin, when they open an entity record that is not soft-deleted, then "Report issue" is visible and enabled. The reporter is always the logged-in user. "Monitoring (automatic)" exists only as the reporter of the seeded issue ISS-1042 and cannot be chosen in the form.

AC2. **Form fields.** The form holds exactly these fields:

| Field | Type | Validation | Example |
|---|---|---|---|
| Affected entity | read-only on an entity record; multi-select of member entities on a group record (AC4) | at least one entity | Revolut Ltd |
| Type | single select, the 8 types: "Service unavailable or latency", "Partner degraded or unavailable", "Wrong match result", "Integration blocker", "Billing", "Possible data breach or security", "Commercial or coverage", "Other" | required | Wrong match result |
| Product line | single select of the entity's product lines, shown as "<product> / <country>, <stage>" | optional | UK CoP / GB, Live & hypercare |
| Scheme | single select: EU VoP, UK CoP, Global validation | required for "Service unavailable or latency", "Partner degraded or unavailable", "Wrong match result" and "Integration blocker"; optional for the other types | UK CoP |
| Country | single select, ISO country list | same rule as Scheme | GB |
| Description | plain text with line breaks | required, 20 to 5,000 characters | "Payee 'J Smith Plumbing Ltd' returns No match for the trading name 'Smith Plumbing'. 14 cases since 08:00." |
| Corvane aware at | date and time, in the reporter's time zone | required; defaults to now; cannot be in the future | 05 Oct 2026, 08:40 CEST |
| Reported at the customer by | single choice: an active contact of the entity, "Someone else" (name required, up to 120 characters) or "Found by Corvane" | required | Priya Nair (Incident contact) |
| Impact | single choice: "Down", "Degraded", "Isolated case", "Question or request" | required | Isolated case |
| Possible data breach | Yes / No | required, no default | No |

Selecting a product line fills Scheme and Country with its values and locks them. Clearing the product line unlocks them.

AC3. **Validation blocks the save.** Given a required field is empty or out of range, when the user clicks "Report issue", then the form stays open, shows an inline message under each invalid field and saves nothing. The messages are:
- Type: "Select the issue type"
- Scheme and Country: "Select the scheme and country affected"
- Description: "Describe the issue in 20 to 5,000 characters"
- Corvane aware at in the future: "Corvane aware at cannot be in the future"
- Reported at the customer by: "Select who reported it, or choose Found by Corvane"
- Impact: "Select the impact"
- Possible data breach: "Answer Yes or No"

Every other field keeps the value the user typed.

AC4. **Report from a group.** Given Tom Hadley opens the group "Santander" and clicks "Report issue", then the form shows the 4 member entities as checkboxes (Santander UK plc, Banco Santander Totta, S.A., Santander Consumer Bank S.p.A., Banco Santander Consumer Portugal S.A.), none ticked. The user ticks at least one, otherwise the form shows "Select at least one affected entity". On save, the portal creates one issue per ticked entity (routing rule 8), each routed on its own (M18), and links them to each other under "Related issues" on every Issue page. The confirmation lists every new issue ID.

AC5. **Open similar issues.** Given the entity, scheme and country are set, the form shows the block "Open issues on <entity>, <scheme> <country>" with every issue on that entity whose status is New, In progress, Waiting on customer or Waiting on partner and whose scheme and country match. Each row shows the issue ID, type, severity, status, owner and age, for example "ISS-1038 · Wrong match result · Sev-2 · In progress · Kevin Lim (Ops) · 3 days". With no match, the block reads "No open issues on this entity for this scheme and country". The block refreshes when the scheme, country or product line changes.

AC6. **Add to existing issue.** Given the similar issues block shows ISS-1038 on Revolut Ltd, UK CoP GB, when Emma Wilson clicks "Add to existing issue" on that row and confirms the dialog "Add your report to ISS-1038? No new issue will be created.", then:
- no new issue and no new issue ID are created
- ISS-1038 gets a note "Also reported by Emma Wilson (Customer Success)" with her description, Corvane aware at, reported at the customer by, impact and possible data breach answer
- a toast reads "Your report was added to ISS-1038"
- Emma lands on the ISS-1038 Issue page and follows it as a reporter (M18 AC10)
- the owner and severity of ISS-1038 do not change. If the added report's impact proposes a higher severity than the issue's current one, the note shows "Reported impact suggests Sev-1" so the owner can decide (M19).

"Add to existing issue" is available only while all required fields are valid, so the note is complete.

AC7. **Proposed severity.** Given the impact and possible data breach answers, the form shows "Proposed severity: <Sev-n> (<rule>)", for example "Proposed severity: Sev-2 (Degraded)":
- "Down" proposes Sev-1
- "Degraded" proposes Sev-2
- "Isolated case" proposes Sev-3
- "Question or request" proposes Sev-4
- Possible data breach = Yes proposes Sev-1 whatever the impact, type or stage, and shows "Proposed severity: Sev-1 (Possible data breach)". This rule overrides the caps of AC8 and AC9.

The reporter cannot edit the severity. Only the owner changes it, with a reason (M19). The proposal updates as soon as either answer changes.

AC8. **Pre-go-live cap.** Given the affected product line is at Contract signed, Kickoff, Sandbox & technical integration, Testing & certification, UAT or Go-live approval and Possible data breach = No, then the proposed severity is capped at Sev-3 and the form shows "Capped at Sev-3: <product> / <country> is at <stage>, before go-live. No customer notification clock starts." Example: Zopa Bank Limited, UK CoP / GB at UAT, impact "Down" gives Sev-3 with "Capped at Sev-3: UK CoP / GB is at UAT, before go-live. No customer notification clock starts." Given Possible data breach = Yes on the same line, the proposal is Sev-1 and no cap message shows: a breach carries a legal duty at any stage. With no product line selected, the most advanced stage among the entity's product lines on the selected scheme and country decides. Example: Revolut Ltd with Scheme UK CoP and Country GB and no product line uses P15, Live & hypercare, so no cap applies.

AC9. **Types capped at Sev-2.** Given the type is "Billing" or "Commercial or coverage" (owner teams Finance and Sales, which have no on-call) and Possible data breach = No, then the highest proposed severity is Sev-2, with the line "Highest severity for this type: Sev-2". Example: impact "Down" on a Billing report proposes Sev-2. Given Possible data breach = Yes, the proposal is Sev-1 (AC7).

AC10. **Happy path.** Given Emma Wilson (Customer Success) opens Revolut Ltd and reports type "Wrong match result", product line UK CoP / GB, a description, Corvane aware at 05 Oct 2026, 08:40 her time, reported by Priya Nair, impact "Isolated case", possible data breach "No", when she clicks "Report issue", then:
- the issue is saved as ISS-1043 (the next free number after ISS-1042) with status New and severity Sev-3
- routing runs on save (M18) and the Issue page opens with the M18 confirmation
- the entity's Issues tab lists ISS-1043 at the top

While saving, "Report issue" shows a spinner and is disabled, so a double click creates one issue.

AC11. **Reporter edits the description until acknowledgement.** Given the reporter opens their issue while its status is New, then the description shows an "Edit" link. Once the owner clicks "Acknowledge", the description is read-only for the reporter and the link is gone. The reporter can add notes at any time. Every other field is edited only by the roles in the conventions.

AC12. **Audit and History.** Given an issue is saved, then:
- one audit entry is written for the creation, with every field value, user, team and timestamp, plus one audit entry per later change (M16)
- the entity History tab shows the event "Issue ISS-1043 reported by Emma Wilson (Customer Success): Sev-3, Wrong match result, UK CoP GB" with the Incident event type, and a link to the issue (M10)
- an "Add to existing issue" action writes an audit entry on the target issue and the History event "Report added to ISS-1038 by Emma Wilson (Customer Success)"
- a description edit before acknowledgement writes old and new values to the audit log

AC13. **Server-side check.** Given a request to create an issue on a soft-deleted entity, or with "Monitoring (automatic)" as reporter, or with an "Corvane aware at" in the future, then the server rejects it with a validation error and saves nothing. A description edit by anyone other than the reporter, or by the reporter after acknowledgement, returns 403 (M15).

**Release split:** Release 1: AC1 to AC13. Release 2: none.

**States:**
- **Empty:** the entity Issues tab with no issues shows "No issues reported on this entity" and the "Report issue" button.
- **Loading:** the similar issues block shows two skeleton rows while it loads. The product line and contact pickers show a spinner while they load. The rest of the form stays usable.
- **Error:** if the similar issues block fails, it shows "Couldn't check for open issues. Retry" and the user can still save. If the save fails, the form stays open with every typed value kept, shows the banner "Issue not reported. Try again." and writes nothing to the audit log.
- **Read-only:** on a soft-deleted entity, "Report issue" is hidden for all users and the Issues tab is read-only. After acknowledgement, the reporter sees the description as text.

**Edge cases:**
1. **Partner-only entity.** On Oversea-Chinese Banking Corporation Limited (partner only, no product lines), the Product line field is hidden. Scheme and Country list the entity's coverage rows first, for example "Global validation / SG". No pre-go-live cap applies, because the cap reads customer product lines only.
2. **Entity with both roles.** On Lloyds Bank plc, the Product line field lists the customer product lines (UK CoP / GB, BAU and Global validation / GB, Sandbox & technical integration). A report of type "Partner degraded or unavailable" on Lloyds is handled by M23.
3. **Lines at different stages.** Revolut Ltd has UK CoP / GB at Live & hypercare. A report on UK CoP GB without a product line uses that stage. If the user picks Global validation / SG (Testing & certification), impact "Down" proposes Sev-3 with the cap message.
4. **Billing without scheme.** A Billing report on UniCredit Bank GmbH can be saved with no scheme and country. The similar issues block then matches open issues on the entity that also have no scheme and country, so ISS-1031 appears.
5. **Corvane aware long before saving.** Emma reports impact "Down" on Revolut Ltd, UK CoP / GB (Incident notification time 2 h), with Corvane aware at 3h 25m before now. The issue saves as Sev-1. The notification clock (M19) already shows "Overdue by 1h 25m" in red on the Issue page.
6. **No scheme and no product line.** For a type where scheme is optional and none is selected, the most advanced stage among all the entity's product lines decides the cap.
7. **Inactive entity.** On Raiffeisen Bank International AG (lifecycle Inactive), "Report issue" stays available, so a billing dispute after termination can be recorded.
8. **Similar issue closes while the form is open.** The user clicks "Add to existing issue" on an issue that was Resolved a minute earlier. The server rejects it with "ISS-1038 is no longer open. Report a new issue instead." and the form keeps every value.
9. **Contact marked Left later.** The customer reporter contact is later marked Left (M7). The issue keeps the name as saved, with a "Former contact" label.

**Out of scope (phase 2):**
- Creating issues automatically from email, Slack, a customer portal or the monitoring system (ISS-1042 is seeded).
- Attachments and screenshots on the report.
- Merging two issues that were reported separately.
- Reporting from a mobile app.

---

### B.M18: Automatic triage, visible to the reporter

**Story (EN):** As the reporter of an issue, I want to see immediately who became the owner, who the communicator is and what deadline the issue has, set automatically from the issue type, the customer's named issue team and the owner team's business hours (out of hours, Sev-1 goes to on-call and the rest waits for the start of business hours), and to follow the issue until it is closed, so that I can tell the customer who is handling it and the problem does not stay with me.

**Screens:**
- Issue page, header: "Owner", "Communicator", "Contributors", the next deadline and the "Why this owner" line.
- Issue page, confirmation banner shown right after saving (M17).
- Entity record, Details tab: the "Issue team" block (named person per team, read-only).
- Home worklist, "Issues" section, "Reported by me" group (M20).

**Acceptance criteria:**

AC1. **Routing runs on save, with no manual choice.** Given an issue is saved (M17), then the server applies the routing rules below in the same transaction. The report form has no owner, communicator or contributor field. If routing fails, nothing is saved (see States).

AC2. **Owner team from the type.** The type sets the owner team: "Service unavailable or latency", "Wrong match result", "Integration blocker" and "Other" go to Ops; "Partner degraded or unavailable" to Network; "Billing" to Finance; "Possible data breach or security" to Compliance; "Commercial or coverage" to Sales.

AC3. **Inside business hours: the named person.** Given the save time is inside the owner team's business hours (Monday to Friday, 09:00 to 18:00; Ops in Asia/Kuala_Lumpur; Network, Compliance and Finance in Asia/Singapore; Sales in the named person's own time zone), then the owner is the entity's named person in that team. Example: Emma Wilson reports a "Wrong match result" on Revolut Ltd at 08:00 her time (08:00 CEST, 14:00 MYT) on a Monday, which is inside Ops hours. The owner is Kevin Lim, Revolut's named Ops person.

The issue team on the entity record (Details tab) names one person per team:
- the customer owner (M9);
- the Sales person: the Sales user who created the record, or Tom Hadley (Sales Director) when that user is inactive. Examples: UniCredit Bank GmbH and Banca Monte dei Paschi di Siena S.p.A. have Tom Hadley; Revolut Ltd has Michael Reed;
- one person each from Ops, Network, Finance and Compliance. Where the seed names nobody, the defaults are Network Lukas Brenner, Compliance Mei Chen and Finance Rachel Wong. The seed names Kevin Lim as Revolut Ltd's Ops person.

AC4. **Inside business hours, no named person.** Given the entity's issue team has no named person in the owner team, then the owner is that team's on-call person (this week: Ops Kevin Lim, Network Nora Lee, Compliance Mei Chen), and "Why this owner" reads "No named <Team> person on this entity: routed to on-call". With the seed defaults (AC3) this applies to Ops only: Sales, Network, Finance and Compliance always have a named person.

AC5. **Sev-1 out of hours: the owner communicates until the customer owner starts.**
- Rule 3. Given a Sev-1 saved outside the owner team's business hours, then the owner is the owner team's on-call person, who is also the communicator until the customer owner's business hours start.
- Rule 3b. Given a Sev-1 saved inside the owner team's business hours while the customer owner is outside their own business hours, then the owner is set by AC3 or AC4 and the issue owner is also the communicator until the customer owner's business hours start.
- In both cases, at that moment the communicator changes automatically to the customer owner, and the issue gets the system note "Communication handed over to <customer owner> at <time>. Already communicated: <summary of the recorded notifications, or 'nothing yet'>. Owner: <owner>." (M22 AC10)
- Ownership stays with the issue owner, who can reassign it (M21).

Example (rule 3): seeded ISS-1042 on Banca Monte dei Paschi di Siena S.p.A., saved by "Monitoring (automatic)" the evening before the demo day at 21:12 CEST (03:12 MYT). Owner and communicator Kevin Lim (Ops on-call). Compliance (on-call Mei Chen) records "Possible major incident" at 21:58 CEST (M25). At the start of Emma Wilson's business hours (09:00 CEST), the communicator becomes Emma and the handover note appears.

Example (rule 3b): a Sev-1 on Santander UK plc saved at 05:30 BST (12:30 MYT), inside Ops hours. The owner is Santander UK plc's named Ops person (or the Ops on-call person when none is named), who communicates until 09:00 BST, when Sophie Mitchell takes over.

AC6. **Outside business hours, Sev-2 to Sev-4: the issue waits.** Given a Sev-2, Sev-3 or Sev-4 saved outside the owner team's business hours, then:
- the owner is the entity's named person in the owner team, set at save
- the issue reaches the owner's "Issues" section at the start of the owner team's next business hours (M20 AC8)
- every clock of the issue starts at that moment, and the Issue page shows "Clocks start <date and time in the viewer's time zone>, the start of <Team> business hours"
- the communicator can record a notification before that moment (M22)

Example: Emma reports a Sev-3 "Wrong match result" on Revolut Ltd on Friday 09 Oct 2026 at 16:00 CEST (22:00 MYT, after Ops hours). The owner is Kevin Lim and the clocks start on Monday 12 Oct 2026 at 09:00 MYT. Emma sees "Clocks start 12 Oct 2026 03:00 CEST, the start of Ops business hours".

If the entity has no named person in the owner team, the owner is set when business hours start, to the on-call person on duty at that moment (AC4), and the confirmation reads "Owner: assigned at the start of <Team> business hours".

AC7. **Communicator.** The communicator is the entity's customer owner (M9): Sales until Ops pickup, Ops during onboarding, Customer Success from Ramp-up. Example: on Revolut Ltd the communicator is Adrian Koh (customer owner). On a "Partner degraded or unavailable" issue raised on a partner, the communicator towards the partner is the issue owner (Network), on a partner-only entity and also on Lloyds Bank plc, which is a customer too (routing rule 7, M23 AC3). Each linked customer issue has its own communicator, that customer's owner (M23). When the customer owner changes through M9, M3 or M8, the communicator of every open issue on that entity changes with it, except during the period of AC5 when the issue owner communicates. Example: when scenario 1 hands Revolut Ltd over to Emma Wilson, the communicator of ISS-1038 becomes Emma.

AC8. **Default contributor.** Given the type has a default contributor team (Partner degraded: Ops; Wrong match result: Network; Billing: Sales; Possible data breach: Ops; Commercial or coverage: Network), then the entity's named person in that team is added as contributor on save. Examples: on ISS-1043 (Wrong match result, Revolut Ltd), the contributor is Lukas Brenner; on ISS-1031 (Billing, UniCredit Bank GmbH), the contributor is the named Sales person, Tom Hadley. With no named person in the contributor team, no contributor is added and the Issue page shows "No default contributor: no named <Team> person on this entity". A contributor never comes from on-call.

AC9. **What the reporter sees right after saving.** Given the save succeeds, then the Issue page opens with the banner "Issue ISS-1043 reported" and the header shows:
- "Owner: Kevin Lim (Ops)"
- "Communicator: Adrian Koh (Ops)"
- "Contributors: Lukas Brenner (Network)"
- the first deadline, with its clock text from M19. For ISS-1043 (Sev-3, saved Monday 05 Oct 2026 at 08:40 CEST, 14:40 MYT) Emma sees "Acknowledge by 06 Oct 2026 08:40 CEST" (9 business hours of Ops). A Sev-2 shows "Acknowledge in 1h". A waiting issue shows "Clocks start 06 Oct 2026 03:00 CEST, the start of Ops business hours" (AC6)
- "Why this owner: Revolut Ltd's named Ops person, inside Ops business hours"
- "Copy for the customer", which copies "ISS-1043 is with our Ops team (Kevin Lim). Adrian Koh will keep you updated." for the reporter to pass on

AC10. **Reporter follows the issue.** Given a user reported an issue (or added a report with M17 AC6), then the issue appears in their Home "Issues" section under "Reported by me" (M20 AC6) until it is Closed. The row shows the current status, owner and communicator. Status changes, reassignment and closure show on the Issue page History. The reporter gets no email (in-portal only).

AC11. **Audit and History.** Routing writes one audit entry with owner, communicator, contributors, the rule applied (named person, on-call in hours, on-call out of hours, queued for business hours, issue owner communicates until the customer owner's hours, inherited from the partner issue) and the timestamp. The entity History shows "ISS-1043 routed to Kevin Lim (Ops), communicator Adrian Koh (Ops)". The automatic communicator handover of AC5 writes its own audit entry and History event.

AC12. **Absence skipped (R2).** Given the named person has "Absent until" set to a future date, then routing skips them and assigns the backup in the same team, and "Why this owner" reads "<Name> is absent until <date>: routed to <backup>". In Release 1 there is no "Absent until" field and routing never skips a named person.

**Release split:** Release 1: AC1 to AC11. Release 2: AC12.

**States:**
- **Empty:** an issue with no contributor shows "No contributors yet" (M21). An entity with no issue team shows "Issue team not set" on the Details tab.
- **Loading:** the header role block shows skeleton lines until routing data loads.
- **Error:** if routing cannot complete (for example no on-call person in the seeded rota for that moment), the save is rejected with "Issue not reported: no owner could be found. Try again or contact the admin." and the form keeps every value.
- **Read-only:** the reporter sees owner, communicator and contributors as text. Changing them happens in M21 and M22 under their permissions. The Issue team block is read-only for everyone in the MVP.

**Edge cases:**
1. **Saved exactly at 18:00 owner time.** 18:00:00 counts as outside business hours. 09:00:00 counts as inside.
2. **Weekend Sev-1 on a partner.** A "Partner degraded or unavailable" Sev-1 saved on Saturday on a partner goes to Nora Lee (Network on-call) as owner. She stays the communicator towards the partner, on a partner-only entity and on Lloyds Bank plc alike (routing rule 7).
3. **Customer owner is also the on-call owner.** Kevin Lim is customer owner of Zopa Bank Limited and Ops on-call. An out-of-hours Sev-1 of an Ops type on Zopa would make him owner and communicator with no handover, because the customer owner is the same person. Zopa is before go-live, so in the seed only a possible data breach (owner team Compliance) can make an issue there Sev-1 (M17 AC7).
4. **Sales owner team.** A "Commercial or coverage" issue uses the business hours of the entity's named Sales person, in that person's time zone. Example: on Revolut Ltd the named Sales person is Michael Reed (America/New_York), so Sales hours are 09:00 to 18:00 New York time.
5. **Severity changed later.** If the owner raises a Sev-2 to Sev-1 outside business hours (M19), routing is not rerun. Reassignment stays manual (M21).
6. **Entity has no customer owner.** On a customer entity with "No owner" (M9 AC2), the communicator shows "No communicator: set an owner on the entity" in warning style, and the issue owner sees it on the Issue page. The seed has no customer entity without an owner, so this is a rule for later builds.
7. **Rule 4 issue reported, then severity raised to Sev-1 before business hours.** The owner is not yet working the issue, so the issue stays queued with the named person. Escalation of this case is phase 2 (M24).
8. **Sales person inactive.** The Sales user who created the record is deactivated. The issue team shows Tom Hadley as the Sales person, new Commercial or coverage issues route to him, and he is the default contributor on new Billing issues.
9. **Linked customer issue.** A linked issue created from a partner issue (M23) runs no owner routing: it inherits the parent's owner and needs no separate acknowledgement (routing rule 7). Its communicator is still set by AC7 and AC5.

**Out of scope (phase 2):**
- Phone, email or Slack alerts to the on-call person.
- Editing the issue team and the on-call rota in the portal.
- "Absent until" and backup routing (Release 2, AC12).
- Holiday calendars per country.
- Escalation to the admin ("At risk", M24).

---

### B.M19: Severity and clocks computed from impact, stage and contract

**Story (EN):** As the owner of an issue, I want Customer Hub to compute the severity and the deadlines from the impact, the product stage, the incident notification hours in the contract and the facts deadline the customer needs, to show me every clock ("Notify customer in 1h 20m"), and to let me adjust the severity or the type with a reason, so that I work to the customer's real deadline and never from memory.

**Screens:**
- Issue page (`/issues/[id]`), header: severity badge, type, status, owner, communicator and the next active deadline.
- Issue page, "Clocks" panel: one row per clock with start, target, due time, stop time and state.
- Issue page, "Change severity" and "Change type" dialogs (owner only).
- "Report issue" form (M17): the proposed severity line under the impact question.
- Home worklist, "Issues" section (M20): the clock text on each row.
- Entity record, History tab (M10, "Incident" filter) and Audit tab (M16).

**Acceptance criteria:**

AC1. **Proposed severity from the report.** Given the reporter answers the impact question in the report form (M17), then Customer Hub proposes the severity on save as follows:

| Report answer | Proposed severity |
|---|---|
| Impact "Down" | Sev-1 |
| Impact "Degraded" | Sev-2 |
| Impact "Isolated case" | Sev-3 |
| Impact "Question or request" | Sev-4 |
| "Possible data breach" = Yes, any impact | Sev-1 |

Type "Billing" or "Commercial or coverage" caps the proposal at Sev-2 (M17 AC9). "Possible data breach" = Yes always gives Sev-1 and overrides every cap, including the cap before go-live (AC2). The form shows the proposal under the impact question, for example "Proposed severity: Sev-2 (Degraded)". The severity is computed again on the server at save time, so a crafted request with a different severity is ignored and the computed value is stored.

AC2. **Cap before go-live.** Given the affected product line is at Contract signed, Kickoff, Sandbox & technical integration, Testing & certification, UAT or Go-live approval and "Possible data breach" = No, then the stored severity is at most Sev-3 and no customer notification clock starts. The severity badge carries the label "Sev-3 maximum before go-live: EU VoP / DE is at UAT". The Clocks panel shows the notification row as "Customer notification: not required before go-live".
- Example: a report on Revolut Ltd, EU VoP / DE (UAT, open block "waiting for production certificates") with impact "Down" is stored as Sev-3, with an acknowledge clock of 1 business day and no notification clock.
- From Live & hypercare (Live & hypercare, Ramp-up, BAU) the full rules apply. Example: Revolut Ltd, UK CoP / GB (Live & hypercare) with impact "Down" is stored as Sev-1.
- With "Possible data breach" = Yes the cap does not apply: the issue is stored as Sev-1 and the full rules apply at any stage. Example: a breach reported on Revolut Ltd, EU VoP / DE (UAT) is stored as Sev-1 with a 15-minute acknowledge clock and a notification clock of 2 hours (Revolut's Incident notification time).

AC3. **Stage when no product line is selected.** Given the reporter selects a scheme and country but no product line, then the most advanced stage among the entity's product lines on that scheme and country decides the cap. Example: Revolut Ltd, scheme EU VoP, country DE, no product line: the only line is EU VoP / DE at UAT, so the cap applies. Given an entity with a customer role has no product line on that scheme and country, then the cap applies and the badge reads "Sev-3 maximum before go-live: no live product on EU VoP / DE".

AC4. **Acknowledge clock.** The acknowledge clock starts on save, or at the start of the owner team's next business hours for a Sev-2 to Sev-4 reported outside them (routing rule 4). It stops when the owner clicks "Acknowledge" (M21 AC1). Targets:

| Severity | Target | How it is counted |
|---|---|---|
| Sev-1 | 15 minutes | Elapsed time, 24 hours a day |
| Sev-2 | 1 hour | Elapsed time, from the clock start |
| Sev-3 | 1 business day | 9 business hours in the owner's business hours (Monday to Friday, 09:00 to 18:00, owner team time zone) |
| Sev-4 | 3 business days | 27 business hours, counted the same way |

AC5. **Customer notification clock.** Given the severity is Sev-1 or Sev-2 and the cap of AC2 does not apply, then the notification clock starts at "Corvane aware at" (or at the business-hours start under routing rule 4) and stops when the communicator records a notification (M22 AC6). Targets:
- Sev-1: the "Incident notification time" (hours) on the entity's Customer agreement card (M13), counted in elapsed hours.
- Sev-1 with no captured value: 2 hours, and the Clocks panel row shows "Default deadline: the contract has no notification time".
- Sev-2: 4 business hours of the communicator (Monday to Friday, 09:00 to 18:00, in the communicator's time zone).
- Sev-3 and Sev-4: no notification clock. The Clocks panel row reads "Customer notification: no deadline at Sev-3".

The value is read from the Customer agreement card at the moment the clock starts and stored on the issue, so a later edit of the card by Compliance leaves the running clock unchanged.

AC6. **Worked example 1: Sev-1 at night, ISS-1042.** Given the seed issue ISS-1042, reporter "Monitoring (automatic)", type "Service unavailable or latency", impact "Down", Banca Monte dei Paschi di Siena S.p.A., EU VoP / IT (BAU), saved the evening before the demo day at 21:12 Europe/Amsterdam local time (21:12 CEST, 03:12 MYT on the demo day), then:
- Ops is outside business hours (09:00 to 18:00 MYT), so the owner and the communicator are the Ops on-call person, Kevin Lim (routing rule 3).
- Acknowledge: target 15 minutes, due 21:27 CEST (03:27 MYT). At 03:18 MYT Kevin sees "Acknowledge in 9 min".
- Customer notification: MPS has Incident notification time = 6 on its Customer agreement card, so it is due at 03:12 CEST on the demo day (09:12 MYT). At 03:52 MYT, after acknowledging, Kevin sees "Notify customer in 5h 20m".
- Compliance assessment (M25): MPS is a regulated customer (EU DORA) and the issue is Sev-1, so the issue is flagged for Compliance and the Clocks panel shows "Compliance assessment" due 22:12 CEST, owned by the Compliance on-call person, Mei Chen. The seed records her assessment "Possible major incident" at 21:58 CEST, so the row shows "Assessed 46 min after the flag (target 1h)".
- Emma Wilson (Europe/Amsterdam) opening the issue sees every time in CEST, for example "Corvane aware at 21:12 CEST". Kevin Lim (Asia/Kuala_Lumpur) sees the same instants in MYT, for example "Corvane aware at 03:12 MYT".

AC7. **Worked example 2: Sev-2 outside Ops hours.** Given Emma Wilson reports a "Wrong match result" on Revolut Ltd, UK CoP / GB (Live & hypercare), impact "Degraded", on Monday 05 Oct 2026 at 15:40 CEST (21:40 MYT), saved as ISS-1044 (the next number after Emma's ISS-1043 of M17 AC10), then:
- The owner is Revolut's named Ops person, Kevin Lim, the communicator is Revolut's customer owner, Adrian Koh, and the default contributor is Revolut's named Network person, Lukas Brenner.
- Ops hours ended at 18:00 MYT, so the issue enters Kevin's worklist on Tuesday 06 Oct 2026 at 09:00 MYT (03:00 CEST) and every clock starts then (routing rule 4).
- Until then the Clocks panel shows no countdown and the line "Clocks start 06 Oct 2026 09:00 MYT, the start of Ops business hours" for Kevin and Adrian, "Clocks start 06 Oct 2026 03:00 CEST, the start of Ops business hours" for Emma.
- Acknowledge: due 06 Oct 2026 10:00 MYT. Customer notification: 4 business hours of the communicator, Adrian Koh (Asia/Kuala_Lumpur), due 06 Oct 2026 13:00 MYT (07:00 CEST).
- Adrian Koh can record a notification before 09:00 MYT. The notification clock then never starts and the row shows "Notified before the clock started".

AC8. **Worked example 3: business days.** Given Rachel Wong is UniCredit Bank GmbH's named Finance person and a "Billing" issue with impact "Isolated case" (Sev-3) is saved on Friday 09 Oct 2026 at 16:30 SGT, then the acknowledge clock counts 1h 30m on Friday and 7h 30m on Monday, and the issue is due "Acknowledge by 12 Oct 2026 16:30 SGT". Given an "Integration blocker" Sev-4 on Monzo Bank Ltd (Global validation / GB, Kickoff) saved on Wednesday 07 Oct 2026 at 11:00 MYT, then it is due "Acknowledge by 12 Oct 2026 11:00 MYT" (7 + 9 + 9 + 2 business hours).

AC9. **Worked example 4: default deadline.** Given Zopa Bank Limited's UK CoP / GB line has moved to Live & hypercare and its Customer agreement card has Incident notification time "Not captured", when a Sev-1 is saved with Corvane aware at 10:00 CEST, then the notification is due at 12:00 CEST and the row shows "Default deadline: the contract has no notification time".

AC10. **Facts clock for the customer's regulator** (R2). Given Compliance records "Possible major incident" on the issue (M25), then the "Facts for the customer's regulator" clock starts at that moment with the target "Facts needed within (hours)" from the Customer agreement card (M26), and stops when the communicator records "Facts pack sent" (M22 AC13). Example: MPS has "Facts needed within (hours)" = 2 (M26 AC10). Mei Chen records "Possible major incident" on ISS-1042 at 21:58 CEST, so the facts pack is due at 23:58 CEST; at 22:18 CEST the row shows "Send facts pack in 1h 40m". Given the card has no value, the row shows "Facts deadline not captured" in red with no countdown, and Compliance can still record the assessment.

AC11. **Data breach clock** (R2). Given Compliance records "Possible data breach" (M25), then the "Data breach notification" clock starts with an internal target of 24 hours and the rule label from the Corvane signing entity on the Billing profile (M14): "GDPR" for Corvane Europe B.V. (for example Banca Monte dei Paschi di Siena S.p.A.) and "PDPA" for Corvane Singapore Pte. Ltd. (for example Revolut Ltd). The row reads "Notify without undue delay (GDPR). Internal target 24h".

AC12. **Clock text and the one visible deadline.**
- Formats: under 60 minutes "Acknowledge in 9 min"; 60 minutes to 24 hours "Notify customer in 1h 20m"; 24 hours or more, the due time "Acknowledge by 12 Oct 2026 16:30 SGT"; within the due minute "Update due now" or "Notify customer now"; past due "Overdue by 25 min" in red.
- The header shows the active clock with the earliest due time, and that is the deadline used for the worklist order (M20). The Clocks panel lists every clock, including stopped ones with the result, for example "Notified 53 min after Corvane aware at (target 6h)" or "Acknowledged 3 min late" in red.
- Due times are computed on the server from the demo clock (`src/lib/dates.ts`). The text refreshes at least every 60 seconds without a page reload. Times display in the viewer's time zone with its abbreviation from a fixed map (CET/CEST, EET/EEST, WET/WEST, GMT/BST, MYT, SGT, EST/EDT), for example "21:12 CEST". Business-day targets count 1 business day as 9 business hours (Sev-4: 27).

AC13. **Change severity with a reason.** Given the current user is the owner, when they click "Change severity", then a dialog shows the current severity, the new severity (Sev-1 to Sev-4), a required reason (10 to 500 characters) and "Cancel" and "Change severity" buttons. Under the cap (AC2), Sev-1 and Sev-2 are disabled with the tooltip "Sev-3 is the maximum before go-live". On "Billing" and "Commercial or coverage", Sev-1 is disabled with the tooltip "Highest severity for this type: Sev-2". When "Possible data breach" = Yes, no option is disabled. After save, the badge updates, a toast reads "Severity changed to Sev-1" and the reason shows on the activity entry.

AC14. **Severity raised: recalculation from Corvane aware at.** Given the severity goes up, then every deadline is recalculated. The notification target is recalculated from "Corvane aware at" and an unacknowledged acknowledge clock gets the new target from its original start. Example: a Sev-2 on Revolut Ltd, UK CoP / GB, Corvane aware at Monday 10:00 CEST (16:00 MYT), is due "Notify customer" on Tuesday at 05:00 CEST (11:00 MYT): 4 business hours of the communicator, Adrian Koh, 2 on Monday and 2 on Tuesday. The owner raises it to Sev-1 at 11:30 CEST. Revolut's Incident notification time is 2, so the notification is now due at 12:00 CEST and shows "Notify customer in 30 min". Raised at 12:20 CEST instead, it shows "Overdue by 20 min" at once.

AC15. **Severity lowered** (R1 part). Given the owner lowers the severity, then the change and its reason are saved, and every clock already started keeps its target and due time.

AC16. **Severity lowered: fine recalculation** (R2). Given the owner lowers the severity before a notification is recorded, then the notification clock stays visible with its original due time until a notification is recorded, an unacknowledged acknowledge clock takes the target of the new severity, and the update cadence follows the new severity (M22 AC14). Example: had ISS-1042 been lowered from Sev-1 to Sev-3 at 21:20 CEST, before acknowledgement, the acknowledge target would become 1 business day and the notification clock would still show the 03:12 CEST due time.

AC17. **Change type with a reason.** Given the current user is the owner, when they click "Change type", choose a new type and enter a reason (10 to 500 characters), then:
- The owner team becomes the team of the new type and the routing rules run again at the time of the change (owner rules 2 to 4).
- The status returns to New and the acknowledge clock restarts at the time of the change with the target of the current severity.
- The notification clock keeps its start ("Corvane aware at") and its target.
- The default contributor of the new type is added. Contributors already on the issue stay.
- The previous owner loses owner rights and keeps read access and notes, like every user.
Example: ISS-1044 (AC7) changes from "Wrong match result" (Ops) to "Partner degraded or unavailable" on Tuesday 06 Oct 2026 at 10:30 SGT. The owner becomes Revolut's named Network person, Lukas Brenner, the default contributor becomes Revolut's named Ops person, Kevin Lim, and the header shows "Acknowledge in 1h" (Sev-2).

AC18. **Type change and the severity limits.** Given the new type changes nothing about the product stage, then the severity stays as stored. Given the cap from AC2 applies, the severity stays at Sev-3 or below whatever the type. Given the new type is "Billing" or "Commercial or coverage", the issue is Sev-1 and "Possible data breach" = No, then the dialog sets the new severity to Sev-2 with the line "Highest severity for this type: Sev-2", and the change of severity is saved with the type change reason.

AC19. **Permissions.** Only the owner can change severity or type. Every other user sees the severity and type read-only with no controls. A direct API call from any other user returns 403 and changes nothing (M15).

AC20. **Audit and History.** Each severity change, type change and clock outcome (stopped on time, stopped late, overdue) writes an audit entry (object "Issue: ISS-1042", field, old value, new value, reason, user, team, timestamp) and a History event on the entity under the "Incident" filter (M10), for example "ISS-1042 severity changed from Sev-2 to Sev-1 by Kevin Lim: Second scheme now affected".

**Release split:** Release 1: AC1 to AC9, AC12 to AC15, AC17 to AC20. Release 2: AC10, AC11, AC16.

**States:**
- **Empty:** a Sev-3 or Sev-4 issue shows only the acknowledge row in the Clocks panel plus "Customer notification: no deadline at Sev-3". A resolved issue shows "No active clocks".
- **Loading:** a skeleton line in place of the header deadline and three skeleton rows in the Clocks panel. "Change severity" and "Change type" stay disabled until the clocks load.
- **Error:** if the clocks fail to load, the header shows "Deadlines unavailable. Retry" in carmine and the panel offers "Retry". If a severity or type change fails, the dialog keeps the values and shows "Change not saved. Try again."
- **Read-only:** non-owners see severity, type and all clocks with no edit controls. Closed issues show the final clock results with no controls for anyone.

**Edge cases:**
1. **Severity raised after notification.** ISS-1044 was notified as Sev-2 at 10:00 MYT, then raised to Sev-1 at 11:00 MYT. The notification clock stays stopped with its recorded result, the issue shows "Severity raised after notification. Tell the customer in the next update" and the update cadence moves to Sev-1 (R2).
2. **Type change across time zones.** A Sev-3 "Billing" issue on UniCredit Bank GmbH is changed to "Service unavailable or latency" on Monday at 19:30 SGT, after Ops hours. It waits for 09:00 MYT on the next business day: the status shows New and Rachel Wong (Singapore) sees "Clocks start 06 Oct 2026 09:00 SGT, the start of Ops business hours". Had the issue been Sev-1 (possible data breach), it would go to the Ops on-call person, Kevin Lim, at once.
3. **M13 notification time missing.** Zopa Bank Limited has no Incident notification time. While its UK CoP / GB line is at UAT no notification clock runs (AC2). Once live, a Sev-1 uses the 2-hour default with the label (AC9).
4. **Card edited during an issue.** Compliance changes MPS's Incident notification time from 6 to 4 while ISS-1042 is open. ISS-1042 keeps 6 hours (AC5). New issues use 4.
5. **Product goes live while an issue is open.** Revolut's EU VoP / DE moves from UAT to Live & hypercare while a capped Sev-3 issue is open. The cap label disappears and the owner can raise the severity with a reason. Nothing changes automatically.
6. **Product line cancelled or moved back.** A product moves back from Live & hypercare to UAT while a Sev-1 is open. The stored severity and running clocks stay. The change only affects new issues and later severity changes.
7. **Acknowledged late.** Had Kevin acknowledged ISS-1042 at 21:30 CEST instead of 21:21 CEST (M21 AC1), the acknowledge row would show "Acknowledged 3 min late" in red, and the audit entry would record the delay.
8. **Due minute.** Within the minute of the due time the text reads "Notify customer now" (same pattern as "Update due now"); one minute later it reads "Overdue by 1 min" in red. The text "in 0 min" never appears.
9. **Weekend.** A Sev-3 saved on Saturday at 11:00 SGT starts counting on Monday 09:00 SGT and is due Monday 18:00 SGT.

**Out of scope (phase 2):**
- Resolution clock with severity targets and a pause during "Waiting on customer" and "Waiting on partner".
- Holiday calendars per country for business days.
- Phone, email or Slack alerts when a clock is close to its due time.
- Escalation of clocks at risk to the admin (M24).
- Automatic severity from monitoring signals.

---

### B.M20: "Issues" section in the worklist

**Story (EN):** As a user from any of the 6 teams, I want an "Issues" section at the top of my worklist with the issues where I am owner, communicator or contributor, ordered by the time left to the next deadline, with the severity, the entity, the clock and the step I have to take (acknowledge, notify, send update, resolve, close), so that I start with what is most urgent for the customer.

**Screens:**
- Home worklist (screen 1), "Issues" section, with the groups "Contributing" and "Reported by me".
- Home navigation item: the count badge.
- Issue page: the target of every row.

**Acceptance criteria:**

AC1. **First section for every team.** Given a user from any of the 6 teams opens Home, then "Issues" is the first section, above every M11 section (for example above "To pick up" for Ops and CS). Its title shows the number of rows in the section, across every group that appears (main list, "Contributing", "Reported by me"), for example "Issues (3)". The Home badge counts only the rows where the user has a step (AC9). The section shows even when empty (States).

AC2. **Which issues appear.** The main list holds every issue that is not Closed where the user is the owner, the communicator or the Compliance assessor with an assessment to record (M25 AC4). Contributor issues appear only in "Contributing" (AC5) and reported issues only in "Reported by me" (AC6). An issue appears once per user, in the highest group that applies: main list, then Contributing, then Reported by me.

AC3. **Order.** Rows in the main list sort by:
1. time left to the next active deadline, ascending, so overdue rows come first, most overdue at the top
2. severity, Sev-1 first
3. Corvane aware at, oldest first
4. issue ID, ascending

Rows with no active deadline (for example an acknowledged Sev-3 waiting to be resolved) come after every row with a deadline, sorted by rules 2 to 4.

AC4. **Row content and next step.** Every row shows:
- the severity chip (Sev-1 red, Sev-2 orange, Sev-3 and Sev-4 grey)
- the issue ID and type
- the entity name and country, and the scheme and country when set
- the status
- my role: "Owner", "Communicator", "Owner and communicator" or "Compliance"
- the next step for me and its clock text
- an "Open" link to the Issue page

The next steps in Release 1 are:

| Who | Condition | Step text | Clock text |
|---|---|---|---|
| Owner | status New | "Acknowledge" | "Acknowledge in 9 min" |
| Communicator | Sev-1 or Sev-2, no notification recorded | "Notify customer" | "Notify customer in 1h 20m" |
| Owner | status In progress, Waiting on customer or Waiting on partner | "Resolve" | none |
| Communicator | status Resolved | "Close with the customer" | none |
| Compliance assessor | issue flagged for Compliance, no assessment (M25) | "Assess for Compliance" | "Assess in 42 min" |

An overdue clock reads "Overdue by 25 min" in red. When I have more than one step on the same issue, the row shows the step with the earliest deadline and "+1 more step". Example: at 21:20 CEST on the evening before the demo day, Kevin Lim's row for ISS-1042 shows "Acknowledge in 7 min" and "+1 more step" (the notification). He sees the time as 03:20 MYT.

AC5. **"Contributing" group without a clock.** Given the user is a contributor on an issue that is not Closed, then the issue appears under the "Contributing" heading, after the main list, with no clock and no step. The row shows severity, issue ID, entity, status and "Owner: <name> (<team>)". Rows sort by severity, then Corvane aware at. Example: Lukas Brenner sees ISS-1038 (Sev-2, Revolut Ltd, In progress, "Owner: Kevin Lim (Ops)"). Tom Hadley sees ISS-1031 (Sev-3, UniCredit Bank GmbH, In progress, "Owner: Rachel Wong (Finance)"). Contributing rows count in the section title and never in the Home badge.

AC6. **"Reported by me" group.** Given the user reported an issue or added a report to one (M17 AC6) and holds no other role on it, then it appears under "Reported by me", after "Contributing", with no clock. The row shows severity, issue ID, entity, status, owner and communicator. It leaves when the issue is Closed. These rows count in the section title and never in the badge. Seeded ISS-1042 (reporter "Monitoring (automatic)") appears in nobody's "Reported by me".

AC7. **Examples on the demo day.** With the seed, after 09:00 CEST:
- Adrian Koh sees ISS-1038 as "Communicator" (Revolut's customer owner) in the main list.
- Kevin Lim sees ISS-1038 and ISS-1042 as "Owner" in the main list.
- Rachel Wong sees ISS-1031 as "Owner" with the step "Resolve".
- Emma Wilson sees ISS-1031 as "Communicator" and ISS-1042 as "Communicator" (after the handover, M18 AC5).
- Lukas Brenner sees ISS-1038 and Tom Hadley sees ISS-1031 under "Contributing" (AC5).
- Mei Chen has no ISS-1042 row: her assessment was recorded at 21:58 CEST.
- After scenario 1 hands Revolut Ltd to Emma, ISS-1038 leaves Adrian's main list and appears in Emma's.

AC8. **Waiting issues appear at business-hours start.** Given an issue routed by rule 4 (M18 AC6), then before the owner team's next business hours start, it is absent from the owner's and the communicator's main list, and it does not count in the badge. At the start time it appears with its clocks running. The reporter sees it under "Reported by me" with the label "Queued until <time in the viewer's time zone>".

AC9. **Home badge.** The Home navigation badge counts the main-list rows where the user has a step (AC4) plus the unacknowledged M9 assignments. The badge turns red when any of those rows is overdue or is a Sev-1 with status New. Contributing and Reported by me rows never count.

AC10. **Refresh after action.** Given the user acts on the Issue page (for example clicks "Acknowledge") and returns to Home, then the row shows the new step without a manual reload. While Home is open, the "Issues" section refreshes every 60 seconds, so clock texts and the order stay current with the server's demo clock. A row whose issue is Closed leaves at the next refresh.

AC11. **Scope.** The "Mine" scope shows the user's own rows. For Ops and CS, "My team" shows the rows of every user in the team, with the person's name on each row. "Contributing" and "Reported by me" show only under "Mine".

AC12. **Rows are read-only.** Rows have no inline actions. "Open" leads to the Issue page, where M21 and M22 permissions apply.

AC13. **View as.** Given the "View as" selector switches to another demo user, then the "Issues" section shows that user's rows immediately.

AC14. **Release 2 steps (R2).** Release 2 adds these steps to the AC4 table, with the same ordering rules:

| Who | Condition | Step text | Clock text |
|---|---|---|---|
| Communicator | Sev-1 or Sev-2, after a notification or update (M22 AC14) | "Send update" | "Send update in 1h 15m", then "Update due now" |
| Communicator | Compliance recorded "Possible major incident", facts pack not sent (M25 AC9) | "Send facts pack" | "Send facts pack in 1h 40m", or "Facts deadline not captured" in red |
| Communicator | Compliance recorded "Possible data breach", breach notification not recorded (M25 AC10) | "Notify data breach" | "Notify data breach in 20h" |
| Communicator | status Waiting on customer for 5 business days (M21 AC13) | "Remind customer" | none |
| Owner | root cause report task open (M27 AC4) | "Send root cause report" | "Root cause report due 19 Oct 2026 (in 14 days)" |

A Closed issue with an open root cause report task stays in the owner's main list until the report is recorded (M27 AC6).

**Release split:** Release 1: AC1 to AC13. Release 2: AC14.

**States:**
- **Empty:** with no rows in any group, the section stays visible and shows "No issues for you. Report one from the entity record." The "Contributing" and "Reported by me" headings are hidden when they have no rows.
- **Loading:** two skeleton rows while the section loads. It loads independently of the M11 sections, so a slow M11 section does not delay it.
- **Error:** "Couldn't load your issues. Retry". The M11 sections still render, and the badge keeps its last known count.
- **Read-only:** every row is a read-only view. A user who opens an issue where they hold no editing role sees it read-only, with notes allowed (M21).

**Edge cases:**
1. **Owner and communicator are the same person.** Kevin Lim on ISS-1042 during the night sees one row with the role "Owner and communicator".
2. **Two issues with the same deadline.** Two rows both show "Acknowledge in 12 min". The Sev-1 row comes first. With equal severity, the older Corvane aware at comes first.
3. **Severity lowered before notification.** The owner lowers a Sev-2 to Sev-3 before the customer is notified. The communicator's row keeps "Notify customer" with its clock until a notification is recorded (conventions, Clocks).
4. **Pre-go-live issue.** A Sev-3 on Zopa Bank Limited (UAT) has no notification clock. The communicator has no row step until the issue is Resolved. The owner's row shows "Acknowledge" while New.
5. **Reassignment while Home is open.** The owner reassigns an issue to a colleague (M21). At the next refresh the row leaves the previous owner's list and appears in the new owner's list.
6. **Soft-deleted entity.** Issues on a soft-deleted entity (M16) stay visible on the Issue page and leave every worklist, the same as M11 AC21.
7. **Contributor becomes owner.** Lukas Brenner is contributor on an issue, then the owner changes its type to "Partner degraded or unavailable" and it routes to him (M19). The row moves from "Contributing" to the main list.
8. **Linked customer issues.** The owner of a partner issue (M23) sees one row for the partner issue with "Acknowledge" and no "Acknowledge" step on its linked issues, which need no separate acknowledgement (routing rule 7). Each communicator of a linked issue sees their own row with "Notify customer".

**Out of scope (phase 2):**
- The admin's "At risk" list and escalation (M24).
- Email, push or Slack notifications for new or overdue issues.
- A resolution clock with targets per severity.
- Snooze, dismiss and custom sorting of rows.
- A cross-entity issues list with filters and export.

---

### B.M21: Owner actions on an issue

**Story (EN):** As the owner of an issue, I want to acknowledge it, change its status (In progress, Waiting on customer, Waiting on partner, Resolved with the root cause and the solution), add contributors and internal notes, and reassign the issue within my team with a reason, so that everyone involved sees the real state of the issue.

**Screens:**
- Issue page (`/issues/[id]`), header: "Acknowledge", "Change status", "Reassign issue".
- Issue page, "People" panel: owner, communicator, contributors, "Add contributor".
- Issue page, "Notes" section with "Add note".
- Issue page, "Resolve issue" and "Reassign issue" dialogs.
- Home worklist, "Issues" section (M20), including the "Contributing" group.
- Entity record, History tab ("Incident" filter) and Audit tab.

**Acceptance criteria:**

AC1. **Acknowledge.** Given the issue is New and the current user is its owner, then the header shows the primary button "Acknowledge". When the owner clicks it, then the status becomes In progress, the acknowledge clock stops, the header shows "Acknowledged by <owner> at <time>", a toast reads "Issue acknowledged" and the next step in the owner's worklist changes from "Acknowledge" to the next active clock. Example: Kevin Lim acknowledges ISS-1042 at 21:21 CEST. He sees "Acknowledged by Kevin Lim at 03:21 MYT", Emma Wilson sees "21:21 CEST", and the Clocks panel shows "Acknowledged 9 min after report (target 15 min)". On a partner issue (M23), acknowledging the parent also moves every linked issue in New to In progress: linked issues need no separate acknowledgement (routing rule 7).

AC2. **Status before acknowledgement.** Given the issue is New, then "Change status" is disabled with the tooltip "Acknowledge the issue first". The owner can still change severity or type (M19).

AC3. **Change status.** Given the issue is acknowledged, when the owner opens "Change status", then the options are exactly In progress, Waiting on customer, Waiting on partner and Resolved, with the current status disabled. An optional note (up to 500 characters) is saved with the change. In the MVP no clock pauses during "Waiting on customer" or "Waiting on partner": the notification and update clocks keep running.

AC4. **Resolve with root cause and solution.** When the owner chooses Resolved, then the "Resolve issue" dialog requires:
- Root cause: 20 to 2,000 characters, for example "Expired TLS certificate on the EU VoP IT endpoint after the weekend rotation job failed."
- Solution: 20 to 2,000 characters, for example "Certificate renewed at 22:40 CEST; rotation job alerting added."
A missing or short field shows "Enter at least 20 characters" and saves nothing. After save, the status is Resolved, "Resolved at" is set, the root cause and solution show in a "Resolution" block on the issue, the acknowledge clock and the update clock stop, and the communicator's worklist shows the step "Close with the customer" (M22 AC11). A notification clock with no notification recorded keeps running until the communicator records one (edge case 7, M23 AC11). For a partner issue, resolving the parent sets every linked issue to Resolved (M23 AC11).

AC5. **Back to work before close.** Given the issue is Resolved and not yet Closed, when the owner sets In progress with a reason (10 to 500 characters), then the "Resolution" block is kept and marked "Superseded", the communicator's "Close with the customer" step disappears and the issue returns to the owner's worklist.

AC6. **Contributors.** Given the current user is the owner, when they click "Add contributor", then a searchable picker lists active users of all 6 teams. The default contributor of the type (the entity's named person in that team) is already on the issue after save. The owner can remove any contributor, including the default one, with one click and a confirmation "Remove Lukas Brenner as contributor?". A contributor sees the issue in the "Contributing" group of their worklist, with no clock (M20). A user who is already owner or communicator cannot be added as contributor; the picker shows them as "Already on this issue".

AC7. **Internal notes.** Given any user of the 6 teams opens an issue, then "Add note" is available. A note takes 1 to 5,000 characters of plain text and shows author, team and timestamp in the viewer's time zone. The section header reads "Internal notes. Never sent to the customer". Notes cannot be edited or deleted. Notes show newest first.

AC8. **Reassign within the owner team.** Given the current user is the owner, when they click "Reassign issue", then a dialog shows:
- current owner (read-only)
- new owner: a searchable picker of active users of the owner team only, for example Ops users for "Service unavailable or latency"
- reason: required, 10 to 500 characters
- "Cancel" and "Reassign" buttons
After save, the new owner gets the issue in their worklist, the previous owner loses owner rights, a toast reads "Issue reassigned to Adrian Koh", and every running clock keeps its start and due time. Example: on the demo day at 15:00 MYT Kevin Lim reassigns ISS-1042 to Adrian Koh with the reason "Handing over the night incident to MPS's Ops contact". A linked customer issue (M23) has no "Reassign issue" button: it follows the owner of its partner issue, so reassigning the partner issue reassigns every linked issue (M23 AC17).

AC9. **Reassignment and the communicator.** Given the communicator is the customer owner, then reassignment leaves the communicator unchanged. Given the issue owner is also the communicator (a partner issue, routing rule 7, on a partner-only entity or on Lloyds Bank plc; or the period of routing rules 3 and 3b before the customer owner's business hours start), then the communicator moves with the owner.

AC10. **Reassigning to someone outside business hours.** Given the chosen user is outside their business hours, then the dialog shows the warning "Michael Reed is outside business hours (04:10 in New York). The issue keeps its current deadlines." The owner can still reassign.

AC11. **Permissions.** Only the owner can acknowledge, change status, resolve, add or remove contributors and reassign. Contributors, the communicator and other users see these controls hidden. A direct API call from any of them returns 403, writes nothing and shows "Only the owner, Kevin Lim, can change this issue" if triggered from a stale page (M15).

AC12. **Audit and History.** Acknowledge, every status change, resolve (with root cause and solution), contributor added or removed, reassignment (old owner, new owner, reason) and each note write an audit entry (object "Issue: ISS-1042", field, old value, new value, user, team, timestamp). The entity's History tab shows each as an "Incident" event linked to the issue, for example "ISS-1042 resolved by Kevin Lim. Root cause: Expired TLS certificate...". Notes appear as "Note added to ISS-1042 by Lukas Brenner" with a link.

AC13. **Remind customer** (R2). Given the issue has been in "Waiting on customer" for 5 business days (counted in the communicator's business hours) with no status change and no communication recorded, then the communicator's worklist shows the step "Remind customer" with the text "Waiting on customer for 5 business days". The Issue page shows "Remind customer" to the communicator only; the owner sees the line "Customer reminder due: <communicator>". Recording the reminder (M22 AC7, type "Update") restarts the 5-business-day count.

AC14. **Automatic close from "Waiting on customer"** (R2). Given the issue stays in "Waiting on customer" for 5 more business days after the "Remind customer" step appeared (counted in the communicator's business hours), then Customer Hub sets the status to Closed with the actor "Customer Hub (automatic)" and the reason "Closed automatically: no response from the customer for 10 business days". The issue leaves every worklist (M20 AC10), the Issue page shows the label "Closed automatically" and the entity History shows the event. Reopen follows M22 AC15. The automatic close of a Resolved issue is M22 AC20.

**Release split:** Release 1: AC1 to AC12. Release 2: AC13, AC14.

**States:**
- **Empty:** "No contributors yet" with "Add contributor" (owner only). "No notes yet. Notes are internal and visible to all 6 teams."
- **Loading:** skeletons for the header actions, the People panel and three note cards. Action buttons are disabled until the issue loads.
- **Error:** a failed action keeps the dialog open with the values typed and shows "Action not saved. Try again." A failed load shows "Couldn't load this issue. Retry".
- **Read-only:** non-owners see status, people and resolution with no action controls; "Add note" stays available to all 6 teams. A Closed issue is read-only for everyone except "Add note" and the communicator's "Reopen" (R2).

**Edge cases:**
1. **Contributor tries to change the status.** Lukas Brenner, contributor on ISS-1038, calls the status API directly. The server returns 403 and the status stays In progress. No audit entry is written.
2. **Concurrent actions.** Kevin Lim and Adrian Koh both open ISS-1042; Kevin reassigns it to Adrian at 15:00 MYT while Adrian's page still shows the earlier version. Adrian's "Change status" sent from that stale version is rejected with "This issue was updated by Kevin Lim at 15:00 MYT. Reload to see the current state."
3. **Reassigning out of hours within Sales.** Tom Hadley (Europe/Amsterdam) owns a "Commercial or coverage" issue on Banca Monte dei Paschi di Siena S.p.A. (its named Sales person) and reassigns it to Michael Reed (America/New_York) at 10:00 CEST. The AC10 warning shows "Michael Reed is outside business hours (04:00 in New York)".
4. **Reassign to self.** The current owner appears disabled in the picker with "Current owner".
5. **Acknowledge after the type changed.** The issue changed type (M19 AC17) while the previous owner had the page open. Their "Acknowledge" returns 403 with "This issue now belongs to Network. Reload."
6. **On-call rota changes.** The Ops rota passes from Kevin Lim to another person while ISS-1042 is open. Ownership stays with Kevin until he reassigns it (routing rule 3).
7. **Resolve with a running notification clock.** The owner resolves a Sev-2 before any notification was recorded. The notification clock keeps running, the communicator's row shows "Notify customer" with its clock and "+1 more step" (the close), and "Close" stays available on the Issue page.
8. **Customer replies during "Waiting on customer"** (R2). The owner sets In progress; the 5-business-day count resets and no "Remind customer" step appears for the communicator.

**Out of scope (phase 2):**
- "Absent until" and backup routing for reassignment (M18 R2).
- Escalation and reassignment by the admin (M24).
- Resolution clock with targets per severity.
- Editing or deleting notes, and @mentions with notifications.
- Ticket sync with Jira and the status page.

---

### B.M22: Communication with the customer on an issue

**Story (EN):** As the communicator of an issue, I want to see the entity's incident contact on the issue, to get the message to the customer prefilled from the template and open it in Gmail with one click ("Open in Gmail"), to record each notification and update (time, channel, person, message, including the facts pack sent), to see in my worklist when the next update is due, and to close or reopen the issue with the customer, so that the customer gets a single answer, on time, and we keep evidence of every communication.

**Screens:**
- Issue page (`/issues/[id]`), "Incident contact" block next to the header.
- Issue page, "Communication" section: the prefilled message with "Copy message" and "Open in Gmail", "Record notification", and the communication log.
- Issue page, "Close issue" and "Reopen issue" dialogs.
- Home worklist, "Issues" section (M20): "Notify customer", "Close with the customer" and, in Release 2, "Send update", "Send facts pack", "Notify data breach" and "Remind customer".
- Entity record, History tab ("Incident" filter) and Audit tab.

**Acceptance criteria:**

AC1. **Communicator on the issue.** The header shows "Communicator: Emma Wilson (Customer Success)". The communicator is the entity's customer owner (M9): Sales until Ops pickup, Ops during onboarding, Customer Success from Ramp-up. On a partner issue it is the issue owner (Network), on a partner-only entity and also on Lloyds Bank plc (routing rule 7). Each linked customer issue (M23) has its own communicator, that customer's owner. On a Sev-1, the issue owner communicates while the customer owner is outside business hours (AC9). Given the customer owner changes (M9 reassignment or an accepted handoff, M3, M8), then the communicator of every open issue on that entity changes at once, with a system note. Example: when scenario 1 hands Revolut Ltd to Emma Wilson, ISS-1038's communicator changes from Adrian Koh to Emma Wilson and the note reads "Communicator changed to Emma Wilson: customer owner changed".

AC2. **Incident contact block.** Given the entity has an active Incident contact in the issue's role context (Customer for customer issues, Partner for partner issues), then the block shows the primary Incident contact (M7 AC9): name, job title, phone as a `tel:` link with copy button, email as a `mailto:` link, time zone with the current local time and "Available now" or "Outside availability". Example for ISS-1042: "Silvia Moretti, Payments Operations Manager, +393351234511, silvia.moretti@mps.example, Europe/Rome, local time 22:00 CEST, Available now (24/7)". A link "All incident and escalation contacts" opens the Contacts tab filtered to those roles.

AC3. **Prefilled first notification.** Given the current user is the communicator, then the Communication section shows the message built from the template:
- Subject: "[Corvane] <Severity> incident <issue ID>: <product> <scheme> <country>". A value repeated between product and scheme appears once, so ISS-1042 reads "[Corvane] Sev-1 incident ISS-1042: EU VoP IT".
- Body, exactly in this order, for ISS-1042 prepared by Kevin Lim at 22:00 CEST:

```
Dear Silvia Moretti,

We are informing you of an incident affecting Banca Monte dei Paschi di Siena S.p.A.

Affected service: EU VoP, IT
Corvane aware at: 04 Oct 2026 21:12 CEST
Impact: Down
Current status: In progress
Next update by: 05 Oct 2026 00:00 CEST
Issue ID: ISS-1042

Please quote ISS-1042 in any reply.

Kind regards,
Kevin Lim
Corvane
```

- Times in the message use the incident contact's time zone with its abbreviation. "Next update by" is the preparation time plus the update interval of the severity (Sev-1 2 hours, Sev-2 8 hours), rounded up to the next 5 minutes. For Sev-3 and Sev-4 the line reads "Next update: when the status changes".
- The communicator can edit the subject and body in place before copying. Edits are local to the page until a notification is recorded.

AC4. **Copy message.** When the communicator clicks "Copy message", then the subject and body are copied to the clipboard as plain text (subject on the first line, a blank line, then the body), and a toast reads "Message copied".

AC5. **Open in Gmail.** When the communicator clicks "Open in Gmail", then a new browser tab opens `https://mail.google.com/mail/?view=cm&fs=1&to=<email>&su=<subject>&body=<body>`, with the incident contact's email as recipient and the subject and body URL-encoded. Example recipient for ISS-1042: `silvia.moretti%40mps.example`. Customer Hub sends nothing. After the click, the page shows the hint "Sent it? Record the notification" next to "Record notification".

AC6. **Record notification.** When the communicator clicks "Record notification", then a dialog shows:
- Type: "First notification" (default while the notification clock runs) or "Update"; Release 2 adds "Facts pack sent" and "Breach notification" (AC13)
- Time: required, defaults to now, not in the future, not before "Corvane aware at"
- Channel: required, one of Email, Phone, Video call, Chat
- Person: required, an active contact of the entity (Incident contacts first) or a free-text name
- Message: required, 10 to 5,000 characters, prefilled with the template body when the channel is Email
On save, the entry appears in the communication log, a toast reads "Notification recorded", and a "First notification" stops the notification clock (M19 AC5). Example: Kevin Lim records an Email notification to Silvia Moretti at 22:05 CEST on ISS-1042. The Clocks panel shows "Notified 53 min after Corvane aware at (target 6h)".

AC7. **Record update.** The same dialog with Type "Update" records each later message to the customer, with the same fields and validation. Each update appears in the log in time order.

AC8. **Communication log.** The log lists every entry newest first: type, time in the viewer's time zone, channel, person, recorded by, message (first 3 lines with "Show more"). System entries (communicator changes, hand-back notes) show in grey with the actor "Customer Hub". Entries cannot be edited or deleted. A wrong entry is corrected by recording a new one with the message starting "Correction:".

AC9. **Issue owner as communicator out of hours.**
- Routing rule 3: given a Sev-1 is saved outside the owner team's business hours, then the owner team's on-call person is owner and communicator, and the header shows "Communicator: Kevin Lim (on-call) until 09:00 CEST, then Emma Wilson".
- Routing rule 3b: given a Sev-1 is saved inside the owner team's business hours while the customer owner is outside their own business hours, then the issue owner is the communicator until the customer owner's business hours start. Example: a Sev-1 on Santander UK plc saved at 05:30 BST (12:30 MYT): the owner is Santander UK plc's named Ops person (or the Ops on-call person when none is named), the header shows "Communicator: <owner> (issue owner) until 09:00 BST, then Sophie Mitchell", and at 09:00 BST Sophie Mitchell takes over (AC10).

AC10. **Automatic hand-back to the customer owner.** Given the issue owner is communicator under AC9, when the customer owner's business hours start (09:00, Monday to Friday, in their time zone), then the communicator becomes the customer owner automatically and a system note is added to the log and the notes:
"Communication handed over to Emma Wilson at 09:00 CEST. Already communicated: First notification by Email to Silvia Moretti at 22:05 CEST by Kevin Lim. Owner: Kevin Lim."
Given nothing was recorded, the note reads "Communication handed over to Emma Wilson at 09:00 CEST. Already communicated: nothing yet. Notify customer was due 03:12 CEST. Owner: Kevin Lim." The ownership stays with the issue owner, who can reassign it (M21 AC8). The issue appears in Emma Wilson's worklist with the next step "Notify customer" or "Send update".

AC11. **Close.** Given the status is Resolved and the current user is the communicator, then the header shows "Close". When they click it, the "Close issue" dialog requires the customer confirmation: person (contact picker or free text), channel (Email, Phone, Video call, Chat), time (not in the future, not before "Resolved at") and an optional note up to 500 characters. On save, the status is Closed, "Closed at" is set, the confirmation is added to the communication log as "Closure confirmed", and the issue leaves every worklist. Example: Emma Wilson closes ISS-1031 after Claudia Schulz confirms the corrected invoice by email.

AC12. **Close is the communicator's.** Given the status is not Resolved, then "Close" is hidden. Given the user is the owner but not the communicator, then "Close" is hidden, and a direct API call returns 403.

AC13. **Facts pack sent and breach notification** (R2). Given the "Facts for the customer's regulator" clock runs (M19 AC10), then the record dialog offers the Type "Facts pack sent". Saving it stops that clock and the row shows, for example, "Facts pack sent 1h 40m after Possible major incident (target 2h)" on ISS-1042. The log entry carries a "Facts pack" label so it can be filtered for the customer's auditor. Given the "Data breach notification" clock runs (M19 AC11), then the dialog offers the Type "Breach notification", which stops that clock in the same way and carries a "Breach" label.

AC14. **Update cadence and "Update due"** (R2). After each recorded notification or update, the update clock starts: Sev-1 every 2 hours, Sev-2 every 8 hours. The communicator's worklist row shows "Send update in 1h 15m", then "Update due now", then "Overdue by 25 min" in red. The update clock stops when the issue is Resolved. Example: on ISS-1042, the notification at 22:05 CEST makes the next update due at 00:05 CEST.

AC15. **Reopen within 10 business days** (R2). Given the issue is Closed and fewer than 10 business days have passed since "Closed at" (counted in the communicator's business hours), then the communicator sees "Reopen". It requires a reason (10 to 500 characters). On save, the status becomes In progress, the owner stays the same, the acknowledge clock restarts with the target of the current severity and the owner sees "Acknowledge" again. The log shows "Reopened by Emma Wilson: Customer reports the same mismatch on new payees".

AC16. **After 10 business days: new linked issue** (R2). Given 10 business days or more have passed since "Closed at", then "Reopen" is hidden and the issue shows "Report a new issue linked to ISS-1031", which opens the M17 form prefilled with the entity, product, scheme and country, and the link "Related to ISS-1031".

AC17. **Take over communication** (R2). Given the communicator is marked absent ("Absent until", M18 R2) and the current user is in Customer Success, then the issue shows "Take over communication". A reason (10 to 500 characters) is required. On save, the current user becomes the communicator, the log shows "Communication taken over by Sophie Mitchell from Emma Wilson: <reason>" and the issue moves to Sophie Mitchell's worklist. The action is hidden on partner-only entities.

AC18. **Permissions.** Only the current communicator can record notifications and updates, close, reopen and use the prefilled message actions. Everyone else sees the incident contact block, the log and the template preview read-only. A direct API call from any other user returns 403 and writes nothing (M15).

AC19. **Audit and History.** Each recorded notification, update, closure confirmation, communicator change, hand-back, reopen and takeover writes an audit entry (object "Issue: ISS-1042", field, old value, new value, user, team, timestamp) and a History event on the entity under the "Incident" filter (M10), for example "ISS-1042: First notification to Silvia Moretti by Email, recorded by Kevin Lim". "Copy message" and "Open in Gmail" write nothing.

AC20. **Automatic close of a Resolved issue** (R2). Given the issue has been Resolved for 5 business days (counted in the communicator's business hours) and no closure confirmation or other customer communication has been recorded since "Resolved at", then Customer Hub sets the status to Closed with the actor "Customer Hub (automatic)" and the reason "Closed automatically: no reply from the customer within 5 business days of resolution". The log shows the system entry, the issue leaves every worklist and Reopen follows AC15.

**Release split:** Release 1: AC1 to AC12, AC18, AC19. Release 2: AC13 to AC17, AC20.

**States:**
- **Empty:** the log shows "No communication recorded yet" and, while the notification clock runs, "Notify customer in 5h 20m" above "Record notification".
- **Loading:** a skeleton for the incident contact block, the message preview and three log rows. "Copy message", "Open in Gmail" and "Record notification" are disabled until the issue loads.
- **Error:** if saving fails, the dialog keeps the values and shows "Notification not saved. Try again." If the incident contact fails to load, the block shows "Incident contact unavailable. Retry", and the message is built with the generic greeting (edge case 1).
- **Read-only:** non-communicators see the block, preview and log with no actions. On a Closed issue the log stays visible to all and only "Reopen" (R2) remains for the communicator.

**Edge cases:**
1. **No active incident contact.** Banco Santander Consumer Portugal S.A. has none. The block shows "No active incident contact" in carmine, the greeting reads "Dear Banco Santander Consumer Portugal S.A. team,", "Open in Gmail" opens with an empty recipient, and the hint reads "Add the recipient in Gmail". Its product is at Contract signed, so no notification clock runs.
2. **Incident contact marked as left during the issue.** Ops marks Priya Nair as left while an issue on Revolut Ltd is open. The block switches to the next active Incident contact, or to the carmine alert. Earlier log entries keep "Priya Nair" with the label "Former contact".
3. **Notification time before Corvane aware at.** Kevin enters 21:00 CEST on ISS-1042. Save is blocked with "The time can't be before Corvane aware at (21:12 CEST)".
4. **Hand-back while the on-call person is recording.** Kevin Lim opens the record dialog at 08:58 CEST and saves at 09:01 CEST, after the hand-back to Emma Wilson. The server returns 403 with "Communication passed to Emma Wilson at 09:00 CEST. Ask her to record this, or add it as a note." Nothing is written to the log.
5. **Partner-only entity at night.** A Sev-1 "Partner degraded or unavailable" on Oversea-Chinese Banking Corporation Limited at 23:00 SGT goes to the Network on-call person, Nora Lee, as owner and communicator. On a partner issue the issue owner is the communicator (routing rule 7), so no hand-back happens and Nora stays communicator.
6. **Entity is customer and partner.** On a linked customer issue on Lloyds Bank plc (M23), the banner reads "This entity is also the affected partner". The communicator stays the customer owner, and the Network owner's note on the partner issue shows what was already said to Lloyds as partner.
7. **Sev-2 recorded before the clock starts.** Adrian Koh records a notification on ISS-1044 at 23:30 MYT, before Ops hours. The notification clock never starts (M19 AC7) and the log shows the entry at 23:30 MYT.
8. **Weekend hand-back.** A Sev-1 on Banca Monte dei Paschi di Siena S.p.A. at 21:12 CEST on a Friday stays with the Ops on-call person as communicator until Monday 09:00 CEST.
9. **Gmail blocked.** The browser blocks the new tab. The page shows "Your browser blocked the Gmail window. Use Copy message" and "Copy message" stays available.

**Out of scope (phase 2):**
- Sending through the Gmail API and attaching the customer's replies to the issue by thread ID.
- Automatic first notification for incidents confirmed by monitoring.
- Microsoft Graph API as an alternative to Gmail.
- Customer status page and customer portal.
- Templates for updates and closure messages beyond the first notification.

---

### B.M23: Partner issue with affected customers and linked issues

**Story (EN):** As a Network Manager, I want the portal, on an issue raised on a partner, to propose the Degraded status on the affected coverage, to list the affected customers (live product lines on the same scheme and country) and to create one linked issue for each of them, with that customer's communicator and contract deadline, attaching the customer issues that are already open, and I want my resolution to resolve all of them, so that no affected customer hears about the problem from someone else before us.

**Screens:**
- Issue page of the partner issue: "Coverage" proposal banner, "Affected customers" panel, "Linked issues" panel.
- "Create linked issues" dialog, opened from the "Affected customers" panel.
- Issue page of each linked issue: "Linked to <issue ID>" header line and, on a dual-role entity, the banner "This entity is also the affected partner".
- Entity record, Partner tab: the M5 status change dialog, prefilled from the proposal.
- Entity record, History tab (filter "Incident") of the partner and of every affected customer; Audit tab (M16).
- Home worklist, "Issues" section (M20), for the owner and for every communicator.

**Acceptance criteria:**

AC1. **What makes an issue a partner issue.** Given a user reports an issue of type "Partner degraded or unavailable" on an entity with the partner role, then scheme and country are required and must match an existing, non-Retired coverage row of that partner (M5). Given Lukas Brenner reports on Lloyds Bank plc with scheme UK CoP and country GB, the save succeeds. Given he picks Global validation / FR, the save is blocked with "Lloyds Bank plc has no coverage for Global validation / FR". Routing follows the conventions: owner team Network, owner = the entity's named Network person inside Network business hours (09:00 to 18:00 Asia/Singapore), default contributor = the entity's named Ops person.

AC2. **Scenario 2 example.** Given Lukas Brenner reports at 10:05 CEST (16:05 SGT) on Lloyds Bank plc: type "Partner degraded or unavailable", UK CoP, GB, "Corvane aware at" 09:55 CEST, impact "Down", description "Lloyds CoP responses above 2 seconds and timeouts since 09:50 CEST", when he saves, then the issue is created as ISS-1050 (IDs in these examples are illustrative), proposed severity Sev-1, owner Lukas Brenner (Lloyds Bank plc's named Network person, the seed default), communicator Lukas Brenner, status New, clock "Acknowledge in 15 min".

AC3. **Communicator of the partner issue.** The communicator of a partner issue towards the partner is the issue owner (Network), also when the partner entity holds the customer role (Lloyds Bank plc), as routing rule 7 sets. The partner issue's message template and "Open in Gmail" use the Partner-context primary incident contact: Paul Grant, paul.grant@lloyds.example. The Customer-context incident contact (Ruth Okafor) is used only on the linked customer issue (AC9).

AC4. **Degraded proposal.** Given the partner issue is saved and the matching coverage row is Active or Onboarding, then the issue shows the banner "Coverage UK CoP / GB is Active. Set it to Degraded?" with the button "Set to Degraded" for Network users. Clicking it opens the M5 status change dialog prefilled with status Degraded, effective date today and reason "ISS-1050: Lloyds CoP responses above 2 seconds and timeouts since 09:50 CEST" (cut to 500 characters). Nothing changes until the user confirms the dialog. On confirm, the coverage row, its status history, the M5 History event and the Lloyds Overview counts ("Active 1, Degraded 1, Onboarding 1") update as in M5 AC7, AC12 and AC15, and the banner changes to "Coverage UK CoP / GB set to Degraded by Lukas Brenner at 10:09 CEST".
- Users of other teams see the banner text "Coverage change proposed to Network" and no button.
- Given the row is already Degraded or Suspended, no proposal appears; the banner reads "Coverage UK CoP / GB is Degraded since 05 Oct 2026".
- "Not now" hides the button for that user's session only; the banner stays until the coverage status changes or the issue is Resolved.

AC5. **Affected customers list.** The partner issue shows the panel "Affected customers (<n>)". A customer is affected when all of these hold:
- the entity has an active customer role, its lifecycle state is not Inactive and it is not soft-deleted;
- it has a product line on the same scheme and country as the partner issue;
- that product line is at Live & hypercare, Ramp-up or BAU.

The list is computed on the server at read time and includes the partner entity itself when it has such a line. Columns: Entity, Product line, Stage, Communicator (the customer owner, M9), Incident notification time (Customer agreement card, M13), Notify by (on a Sev-1, Corvane aware at + that time, or + 2 hours with "Default deadline: the contract has no notification time"; on a Sev-2, 4 business hours of that row's communicator), Linked issue (ID and status, or "None"). Rows sort by "Notify by", earliest first.

Example, Corvane aware at 09:55 CEST:

| Entity | Product line | Stage | Communicator | Incident notification time | Notify by |
|---|---|---|---|---|---|
| Revolut Ltd | UK CoP / GB | Live & hypercare | Adrian Koh | 2 h | 11:55 CEST |
| Santander UK plc | UK CoP / GB | BAU | Sophie Mitchell | 4 h | 13:55 CEST |
| Lloyds Bank plc | UK CoP / GB | BAU | Adrian Koh | 8 h | 17:55 CEST |

AC6. **Customers before go-live are shown apart.** Customers with a line on the same scheme and country at Contract signed through Go-live approval appear in a collapsed group "Not affected: before go-live (<n>)" with entity, product line and stage, and get no linked issue. Example: "Not affected: before go-live (1)" holds Zopa Bank Limited, UK CoP / GB, UAT. Monzo Bank Ltd does not appear: it has no UK CoP line.

AC7. **Create linked issues.** Only the owner of the partner issue sees the button "Create linked issues" on the panel. It opens a dialog with one row per affected customer that has no linked issue yet, every row ticked. For each ticked row without an open issue on the same entity, scheme and country, the action is "Create a new linked issue". On "Create", the server creates all issues in one transaction: either all are created or none, with the error "Linked issues not created. Nothing was saved. Try again." Each new linked issue has:
- entity = the customer; product line = the affected line; scheme and country = the partner issue's;
- type "Partner degraded or unavailable";
- severity = the partner issue's severity (all affected lines are live, so the before-go-live cap never applies here);
- "Corvane aware at" and impact copied from the partner issue;
- description prefilled "Linked to ISS-1050: Lloyds Bank plc UK CoP / GB partner issue." followed by the partner issue's description;
- reporter = the user who clicked "Create";
- owner = the owner of the partner issue (routing rule 7), with "Why this owner: inherited from partner issue ISS-1050"; default contributor = the customer's named Ops person (routing rule 5);
- no acknowledge clock: a linked issue needs no separate acknowledgement. It is created In progress when the partner issue is acknowledged, otherwise New, and acknowledging the partner issue moves it to In progress (M21 AC1);
- communicator = that customer's owner (M9). On a Sev-1 while that customer owner is outside their business hours, the issue owner communicates until they start (routing rules 3 and 3b, M22 AC9);
- "Notify customer" clock from "Corvane aware at" with that customer's own deadline: Sev-1 the Incident notification time on its Customer agreement card (2 hours when not captured), Sev-2 4 business hours of its communicator.

AC8. **Attach open customer issues.** Given a customer in the list has one or more issues in New, In progress, Waiting on customer or Waiting on partner on the same entity, scheme and country, then its dialog row lists them and offers "Attach ISS-<id>" or "Create a new linked issue".
- The default is "Attach" when the open issue's type is "Service unavailable or latency" or "Partner degraded or unavailable".
- For any other type the default is "Create a new linked issue".
- Example in scenario 2: the Revolut Ltd row lists ISS-1038 (Wrong match result, Sev-2) and defaults to "Create a new linked issue", which creates ISS-1052. Santander UK plc and Lloyds Bank plc have no open issue, so the dialog creates ISS-1051 and ISS-1053.
- Variant: had Sophie Mitchell reported ISS-1049 (Service unavailable or latency, Sev-2, Santander UK plc, UK CoP, GB) at 10:00 CEST, the Santander UK plc row would default to "Attach ISS-1049".
- An attached issue keeps its ID, owner, communicator, severity, clocks and history. It gains the header line "Linked to ISS-1050" and appears in the partner issue's "Linked issues" panel. Its owner can raise its severity with a reason (M19); attaching never changes it.

AC9. **Lloyds Bank plc as partner and customer.** Given the partner issue is on Lloyds Bank plc and Lloyds Bank plc is in the affected list as a customer, then its linked issue (for example ISS-1053) is created on the customer role like any other row, and shows:
- the banner "This entity is also the affected partner", with a link "Open ISS-1050";
- under the banner, the latest communication recorded on the partner issue, for example "Network last contacted the partner at 10:12 CEST: Paul Grant, phone", or "Network has not contacted the partner yet";
- communicator Adrian Koh (Lloyds Bank plc's customer owner), with Ruth Okafor (Customer-context incident contact) as the message recipient;
- "Notify customer" deadline from the Lloyds Bank plc Customer agreement card (8 h, notify by 17:55 CEST). The Partner agreement card value (1 h) is shown on the partner issue only, as "Partner agreement incident notification time: 1 h".

Network adds a note on ISS-1053 with what it told the partner; any user can add notes (conventions).

AC10. **Linked issues panel on the partner issue.** The panel "Linked issues (<n>)" lists every linked or attached issue: ID, entity, communicator, status, the communicator's current clock ("Notify customer in 1h 20m", "Overdue by 25 min" in red, or "Customer notified 10:40 CEST"). The panel header shows "Customers notified 1 of 3". Each row opens the linked issue.

AC11. **Cascade resolution.** Given the owner sets the partner issue to Resolved with root cause and solution (M21), then a confirmation reads "Resolve ISS-1050 and 3 linked issues?". On confirm, in one transaction:
- every linked issue in New, In progress, Waiting on customer or Waiting on partner moves to Resolved, with the parent's root cause and solution copied and the system note "Resolved with partner issue ISS-1050 by Lukas Brenner (Network)";
- linked issues already Resolved or Closed stay unchanged;
- a "Notify customer" clock with no notification recorded keeps running after the cascade until the communicator records the notification;
- each communicator gets the step "Close with the customer" in their "Issues" section (M20).

AC12. **Each communicator closes their own.** Closing the partner issue closes only the partner issue. Adrian Koh closes ISS-1052 (Revolut Ltd) and ISS-1053 (Lloyds Bank plc), Sophie Mitchell closes ISS-1051 (Santander UK plc), each after confirming with their customer (M22).

AC13. **Customers that become affected later.** Given the partner issue is not Resolved and a customer line on the same scheme and country moves to Live & hypercare, then the customer appears in "Affected customers" with Linked issue "None" and the owner sees "Create linked issue" on that row. No issue is created without the owner's click.

AC14. **Unlink.** The owner of the partner issue can unlink a linked or attached issue with a reason (5 to 500 characters). The unlinked issue stays open with its communicator and keeps as its own owner the person who owned it at that moment; it no longer follows the partner issue's owner, loses the "Linked to" line, and the cascade no longer reaches it. The customer reappears in "Affected customers" with Linked issue "None".

AC15. **Permissions.** Only the owner of the partner issue can create, attach or unlink linked issues and resolve the parent. The coverage change follows M5 (Network only). Everyone can view both panels. The server returns 403 on any other write (M15).

AC16. **History and audit.** Each created, attached or unlinked issue writes a History event under the "Incident" filter on both entities, for example "Linked issue ISS-1052 created from partner issue ISS-1050 (Lloyds Bank plc, UK CoP / GB). By Lukas Brenner, Network." The cascade writes one event per resolved issue. Every write creates audit entries per field (M16).

AC17. **Linked issues follow the parent's owner.** Given the owner of the partner issue changes (reassignment, M21 AC8, or a type change, M19 AC17), then every linked issue created from it gets the same owner in the same transaction, with one audit entry per issue. Linked issues have no "Reassign issue" button of their own. Attached issues (AC8) keep their own owner.

**Release split:** Release 1: AC1 to AC17. Release 2: none.

**States:**
- **Empty (affected customers):** "No live customers on UK CoP / GB. Nothing to notify." The "Not affected: before go-live" group still shows when it has rows.
- **Empty (linked issues):** "No linked issues yet". The owner sees "Create linked issues".
- **Loading:** skeleton rows in both panels; "Create linked issues" stays disabled until the list has loaded.
- **Error:** on load, "Couldn't load affected customers. Retry". On create, attach or cascade, the transaction rolls back, nothing changes and the message "Linked issues not created. Nothing was saved. Try again." appears.
- **Read-only:** non-owners see both panels with no action buttons.

**Edge cases:**
1. **Night report.** Given Lukas Brenner reports the same partner issue at 21:30 CEST (03:30 SGT), then routing rule 3 applies: Nora Lee (Network on-call) becomes owner and communicator of ISS-1050. Linked Sev-1 issues created at night inherit Nora Lee as owner (routing rule 7), and she is also their communicator while each customer owner is outside business hours; communication passes to each customer owner at the start of that owner's business hours (Sophie Mitchell 09:00 BST, Adrian Koh 09:00 MYT), with the handover note of M22 AC10.
2. **Severity raised on the parent after linking.** The owner raises ISS-1050 from Sev-2 to Sev-1. Linked issues created from it keep their own severity; the dialog after the change shows "3 linked issues are Sev-2. Review their severity." with a link to each. Their owners change severity with a reason (M19).
3. **Partner-only entity.** A partner issue on The Governor and Company of the Bank of Ireland, Global validation / IE, lists affected customers the same way. Today no seeded customer has a live Global validation / IE line, so the panel shows the empty state.
4. **Customer already in the list twice.** A customer with two live lines on the same scheme and country does not exist in the seed; if it occurs, the customer appears once, with both lines in the Product line cell, and gets one linked issue.
5. **Linked issue resolved first.** Revolut Ltd's owner resolves ISS-1052 on its own before the parent (for example, after confirming traffic recovered). The cascade later skips it (AC11).
6. **Soft-deleted or Inactive customer.** An affected customer soft-deleted after its linked issue was created keeps the issue hidden with the entity (M16 AC10). The partner panel counts it as "1 linked issue on a deleted record" without a link.
7. **Coverage set back to Active.** Resolving ISS-1050 does not change the coverage row. Network sets UK CoP / GB back to Active in M5.

**Out of scope (phase 2):**
- Real routing data linking each customer to the partners that answer its verifications (M5 out of scope); the list uses scheme and country only.
- A proposal to set coverage back to Active on resolution.
- Bulk acknowledge or bulk notification across linked issues.
- Automatic notifications to customers or partners (Gmail API).
- Partner issues spanning several coverage rows (for example a routing provider outage in 14 countries): one partner issue per scheme and country in the MVP.

---

### B.M24: Escalation to the admin

Phase 2 by Product Owner decision of 5 October 2026. No acceptance criteria in this release. The "At risk" list, the 75 % notification threshold and reassignment by the admin are not built.

---

### B.M25: Compliance flag and assessment

**Story (EN):** As a Compliance Officer, I want to receive the Sev-1 issues at regulated customers and the issues marked as a possible data breach, and to record my assessment (possible major incident for the customer, possible data breach, neither) within one hour, which starts the right clock, so that the customer gets in time the facts it needs for its regulator.

**Screens:**
- Issue page: "Compliance" block (flag reason, assessment clock, assessment form, assessment history).
- "Record assessment" dialog.
- Home worklist, "Issues" section (M20), for the Compliance assessor and, in R2, for the communicator.
- Entity record, History tab (filter "Incident"); Audit tab (M16).

**Acceptance criteria:**

AC1. **Regulated customer.** A customer is regulated when its Customer agreement card (M13, M26) has "Regulatory regime" captured with a value other than "None": EU DORA, UK FCA, United States, Singapore MAS, UAE CBUAE or Other. "None" means not regulated. An empty field ("Not captured") means unknown and follows AC3. The rule reads the card of the issue's affected entity at the moment of evaluation. A partner issue (M23) reads no card: its linked customer issues are evaluated one by one.

AC2. **When an issue is flagged.** The server evaluates the flag on save, on every severity change and on every type change. The issue is flagged for Compliance when at least one of these holds, and the flag shows each reason that applies:
- Sev-1 at a regulated customer: "Flagged for Compliance: Sev-1 at a regulated customer (UK FCA)";
- "Possible data breach = Yes" on the report, or type "Possible data breach or security": "Flagged for Compliance: possible data breach reported";
- Sev-1 at a customer with no regime captured: "Flagged for Compliance: Sev-1, regulatory regime not captured".

Example: from scenario 2, ISS-1051 (Santander UK plc), ISS-1052 (Revolut Ltd) and ISS-1053 (Lloyds Bank plc as customer) are Sev-1 at UK FCA customers and are each flagged. The partner issue ISS-1050 is not flagged. ISS-1038 (Revolut Ltd, Sev-2, no breach) is not flagged.

AC3. **Nothing captured.** Given a Sev-1 issue at a customer whose card has no regime, or no Customer agreement card at all, then the issue is flagged with the reason "Sev-1, regulatory regime not captured", and the Compliance block shows "Complete the Customer agreement card: regulatory regime not captured" with a link to the Compliance tab. Given the regime is "None" and no breach is reported, the issue is not flagged and the block shows "Not flagged: customer recorded as not regulated".

AC4. **Who assesses.** The flag goes to a Compliance assessor chosen by the routing rules of the conventions: the entity's named Compliance person inside Compliance business hours (09:00 to 18:00 Asia/Singapore); outside them on Sev-1, the Compliance on-call person. In the seed both are Mei Chen. The issue appears in the assessor's "Issues" section with the step "Assess for Compliance" and the clock (M20 AC4). Compliance is a role on the issue: the owner and the communicator do not change.

AC5. **Assessment clock.** On a Sev-1 issue the clock starts when the flag is set and its target is 1 hour: "Assess in 42 min", then "Overdue by 10 min" in red. On a flagged issue below Sev-1 (for example a Sev-3 of type "Possible data breach or security" reported with "Possible data breach" = No) no countdown runs and the block shows "Assessment pending". Example: ISS-1052 is flagged at 10:31 CEST, so the assessment is due at 11:31 CEST; at 10:49 CEST the row shows "Assess in 42 min".

AC6. **Record the assessment.** Only Compliance users see "Record assessment". The dialog offers exactly three options: "Possible major incident", "Possible data breach", "Neither", plus "Rationale" (required, 10 to 1,000 characters). On save, the assessment clock stops and the block shows "Possible major incident. Assessed by Mei Chen (Compliance) at 10:58 CEST." The server returns 403 to any other team.

AC7. **"Neither".** Recording "Neither" closes the flag with the line "Assessed: neither. No regulatory clock started." Severity, owner, communicator and the other clocks stay as they are.

AC8. **Changing the assessment.** Compliance can record a new assessment at any time while the issue is not Closed, with a rationale. The block lists every assessment, newest first. A clock that an earlier assessment started keeps running until it is stopped (AC9, AC10). Example: "Possible major incident" at 10:58 CEST, then "Possible data breach" at 13:20 CEST: the facts clock and the breach clock both run.

AC9. **Facts clock (R2).** Given Compliance records "Possible major incident", then the clock "Facts for the customer's regulator" starts at that moment with the target "Facts needed within (hours)" from the Customer agreement card (M26), read once at start. The communicator gets the step "Send facts pack" with its clock (M20 AC14). The clock stops when the communicator records a communication of type "Facts pack sent" (M22 AC13). Example: ISS-1052 (Revolut Ltd, Facts needed within 4 hours) assessed at 10:58 CEST is due at 14:58 CEST; at 13:18 CEST the communicator's row shows "Send facts pack in 1h 40m".
- Given the card has no value, no countdown runs and the clock shows "Facts deadline not captured" in red, with the link "Complete the Customer agreement card" for Compliance. The step "Send facts pack" still appears.

AC10. **Breach clock (R2).** Given Compliance records "Possible data breach", then the clock "Data breach notification" starts at that moment with an internal target of 24 hours, and the communicator gets the step "Notify data breach" (M20 AC14). The rule label comes from the contracting Corvane entity of the billing profile (M14), or of the invoiced entity when the customer is billed through another entity:
- Corvane Europe B.V.: "GDPR: notify the customer without undue delay. Internal target 24 hours."
- Corvane Singapore Pte. Ltd.: "PDPA: notify the customer without undue delay. Internal target 24 hours."
- not captured: "Rule not set: contracting Corvane entity missing on the billing profile. Internal target 24 hours."

The clock stops when the communicator records a communication of type "Breach notification" (M22 AC13). Examples: Lloyds Bank plc shows PDPA; Santander UK plc (billed through Banco Santander Totta, S.A.) shows GDPR; Zopa Bank Limited (no billing profile) shows "Rule not set".

AC11. **History and audit.** Flag, assessment and clock start or stop each write a History event under "Incident", for example "Compliance assessment: Possible major incident. By Mei Chen, Compliance." and audit entries per field (M16).

**Release split:** Release 1: AC1 to AC8, AC11. Release 2: AC9, AC10.

**States:**
- **Empty:** an unflagged issue shows no Compliance block. A Compliance user's "Issues" section with nothing to assess shows the M20 empty state.
- **Loading:** skeleton of the Compliance block; "Record assessment" disabled until loaded.
- **Error:** on save, "Assessment not saved. Try again", the dialog keeps the selected option and rationale, the clock keeps running and nothing is written to the audit log.
- **Read-only:** users outside Compliance see the block, the reasons, the clock and the assessment history, with no "Record assessment" button.

**Edge cases:**
1. **Severity lowered after the flag.** ISS-1052 goes from Sev-1 to Sev-2 before the assessment. The flag stays with its reason, the countdown is removed and the block shows "Assessment pending".
2. **Severity raised later.** A Sev-2 issue at Santander UK plc is raised to Sev-1 at 12:10 CEST. The flag is set at 12:10 CEST and the 1-hour clock starts then.
3. **Regime changed during an open issue.** Compliance changes Revolut Ltd from UK FCA to None while ISS-1052 is flagged. The existing flag and assessment stay. New issues follow the new value.
4. **Before go-live.** A possible breach reported at Zopa Bank Limited (UK CoP / GB at UAT) is Sev-1 despite the stage, because a possible data breach overrides every cap (M17 AC7). It is flagged with "possible data breach reported" and the 1-hour assessment clock runs.
5. **Seed issue ISS-1042.** ISS-1042 is Sev-1 at Banca Monte dei Paschi di Siena S.p.A. With the seed regime EU DORA (M26 AC10) it is flagged at 21:12 CEST, the assessor is the Compliance on-call person, Mei Chen, and the seed records her assessment "Possible major incident" at 21:58 CEST, inside the target of 22:12 CEST.
6. **Out-of-hours flag below Sev-1.** A Sev-3 "Possible data breach or security" issue with "Possible data breach" = No, flagged at 22:00 CEST, reaches the named Compliance person at the start of the next Compliance business hours (routing rule 4).

**Out of scope (phase 2):**
- Escalation of overdue assessments to the admin (M24).
- Interpretation of any regulation by the portal: the regime and the regulator's deadline are information only.
- A combined "major incident and data breach" option; the sequence in AC8 covers it.
- Alerts outside the portal (phone, email, Slack).

---

### B.M26: Regulatory fields on the Customer agreement card

**Story (EN):** As a Compliance Officer, I want to record on each customer's obligations card (M13) the regulatory regime, the regulator's deadline (as information), how many hours the customer needs to get the facts from Corvane and the deadline of the post-incident report, so that issue priority uses each customer's real deadlines.

**Screens:**
- Entity record, Compliance tab, "Customer agreement" card (M13): new block "Regulatory".
- Issue page: read-only "Customer obligations" block.
- Entity record, Audit tab (M16).

**Acceptance criteria:**

AC1. **Customer card only.** The "Regulatory" block exists on the "Customer agreement" card only. The "Partner agreement" card has no regulatory fields. On Lloyds Bank plc the block appears once, on the Customer agreement card.

AC2. **Fields and validation.**

| Field | Type | Validation | Example |
|---|---|---|---|
| Regulatory regime | enum | EU DORA, UK FCA, United States, Singapore MAS, UAE CBUAE, Other, None | UK FCA |
| Regime name | text | Required when the regime is Other, 2 to 100 characters; hidden otherwise | Hong Kong HKMA |
| Regulator's deadline (information only) | text | 0 to 300 characters | "FCA: notify as soon as aware of a material operational incident" |
| Facts needed within (hours) | integer, hours | 1 to 72, whole numbers only | 2 |
| Post-incident report due (days) (R2) | integer, calendar days after resolution | 1 to 90, whole numbers only | 14 |

Error messages: "Enter a whole number of hours between 1 and 72", "Enter a whole number of days between 1 and 90", "Enter the regime name". A field error blocks the save and keeps every typed value (M13 AC4).

AC3. **Helper text.** Under "Regulator's deadline (information only)": "Customer Hub does not calculate any deadline from this field." Under "Facts needed within (hours)": "Hours within which this customer needs Corvane's facts to report to its regulator, as agreed in the contract."

AC4. **Display of empty and None.** An empty regime displays "Not captured". "None" displays "None: not a regulated customer". When the regime is None, "Facts needed within (hours)" and "Post-incident report due (days)" are disabled; on save their values are cleared and the old values stay in the audit log.

AC5. **Own counter.** The block shows its own counter, "2 of 3 captured" in R1 (regime, regulator's deadline, facts hours) and "of 4" in R2. The M13 counter keeps counting its 8 fields ("8 of 8 captured" stays true for the seed).

AC6. **Edit rights and audit.** Compliance edits the block with the card's "Edit" button (M13 AC5); everyone else sees it read-only with "Owned by Compliance" (M13 AC6). Each changed field writes one audit entry (M16) and refreshes "Last updated by Mei Chen (Compliance), 05 Oct 2026 14:05". The server returns 403 on a write by any other team.

AC7. **Where the values are used.**
- "Regulatory regime": M25 flag (regulated customer), the US alert of the conventions (regime "United States"), M27 task (R2).
- "Facts needed within (hours)": target of the facts clock (M25 AC9, R2).
- "Post-incident report due (days)": deadline of the M27 task (R2).
- "Regulator's deadline": shown only.

A clock or task reads the value once, when it starts. Later card changes apply to clocks and tasks started after the save.

AC8. **On the issue.** Every customer issue shows a read-only block "Customer obligations": Incident notification time, Regulatory regime, Regulator's deadline, Facts needed within, and in R2 Post-incident report due. Example on ISS-1052: "Incident notification time 2 h · UK FCA · Facts needed within 4 h". Empty values show "Not captured".

AC9. **Post-incident report period (R2).** The "Post-incident report due (days)" field and its use in M27 ship in Release 2. In Release 1 the field is not rendered.

AC10. **Seed values.** Regime and facts hours follow the seed table of the conventions. The regulator's deadline text and the report period (R2) complete it:

| Entity | Regime | Regulator's deadline | Facts needed within (h) | Report due (days, R2) |
|---|---|---|---|---|
| Banca Monte dei Paschi di Siena S.p.A. | EU DORA | "DORA: initial notification within 4 hours of classification, at the latest 24 hours after detection" | 2 | 20 |
| Santander UK plc | UK FCA | "FCA: notify as soon as aware of a material operational incident" | 4 | 30 |
| Lloyds Bank plc | UK FCA | same as Santander UK plc | 4 | 14 |
| Revolut Ltd | UK FCA | same as Santander UK plc | 4 | 14 |
| UniCredit Bank GmbH | EU DORA | same as MPS | 2 | 20 |
| Adyen N.V. | EU DORA | same as MPS | 2 | 20 |
| Monzo Bank Ltd | Not captured | | Not captured | |
| Zopa Bank Limited | Not captured | | Not captured | |
| Other customers | None | | | |

**Release split:** Release 1: AC1 to AC8, AC10 (the "Post-incident report due (days)" field, its counter and its seed column ship in Release 2). Release 2: AC9.

**States:**
- **Empty:** a card with no regulatory values shows "Regulatory: not captured" and, for Compliance, "Add regulatory details".
- **Loading and error:** as M13 (skeleton card; "Couldn't load obligations. Retry"; "Changes not saved. Try again" with typed values kept).
- **Read-only:** text values with "Owned by Compliance", no Edit button.

**Edge cases:**
1. **Regime set to None with an open flagged issue.** The flag on the open issue stays (M25 edge case 3).
2. **Facts hours changed during a running facts clock (R2).** Compliance changes Revolut Ltd from 4 to 6 hours at 11:00 CEST. ISS-1052's clock started at 10:58 CEST keeps its due time of 14:58 CEST.
3. **Customer role removed and restored.** The regulatory block is kept with the Customer agreement card and reappears unchanged (M13 edge case 3).
4. **No card at all.** Santander Consumer Bank GmbH, created in scenario 1, has no card. Its issues read "Not captured" for every field (M25 AC3).
5. **Other with a name.** "Other" plus "Hong Kong HKMA" displays "Other: Hong Kong HKMA" on the card and the issue.

**Out of scope (phase 2):**
- Regulatory columns and a regime filter in the Obligations view.
- Rules computed from the regime (deadlines derived from law); the regulator's deadline stays text.
- Several regimes per customer.
- Regulatory fields on the Partner agreement card.

---

### B.M27: Root cause report task

**Story (EN):** As the owner of a Sev-1 issue at a regulated customer, I want the portal to create, on resolution, the post-incident report task with the deadline from the contract, and to record when it was sent, so that we can show the customer and its auditor what happened and what we changed.

All criteria in this story are Release 2.

**Screens:**
- Issue page: "Root cause report" block with the task, deadline and "Record report sent".
- "Record report sent" dialog.
- Home worklist, "Issues" section (M20), for the issue owner.
- Entity record, History tab (filter "Incident"); Audit tab (M16).

**Acceptance criteria:**

AC1. **When the task is created (R2).** When an issue moves to Resolved, by its owner or by the M23 cascade, the server creates the task "Root cause report due" on that issue if all of these hold:
- severity is Sev-1 at the moment of resolution;
- the affected entity is a regulated customer (M25 AC1: regime captured and other than None);
- the issue has no root cause report task yet.

Example: the cascade from ISS-1050 creates one task on each of ISS-1051 (Santander UK plc), ISS-1052 (Revolut Ltd) and ISS-1053 (Lloyds Bank plc). The partner issue ISS-1050 gets none.

AC2. **No task when the regime is missing or None (R2).** Given the regime is "Not captured", no task is created and the issue shows "No root cause report task: regulatory regime not captured", with a link to the Compliance tab. Given the regime is "None", no task is created and nothing is shown.

AC3. **Deadline (R2).** The deadline is the resolution date plus "Post-incident report due (days)" from the Customer agreement card, in calendar days, read once when the task is created. Display: "Root cause report due 19 Oct 2026 (in 14 days)", then "Due today", then "Overdue by 2 days" in red. Example: ISS-1052 resolved on 05 Oct 2026 with Revolut Ltd at 14 days is due 19 Oct 2026; ISS-1051 (Santander UK plc, 30 days) is due 04 Nov 2026.
- Given the days are not captured, the task is created with no deadline and shows "No deadline: the contract has no post-incident report period".

AC4. **Who works on it (R2).** The task belongs to the issue owner. On creation the entity's named Compliance person is added as contributor if not already on the issue (Mei Chen in the seed). The owner's "Issues" section shows the step "Send root cause report" with the deadline; Compliance sees the issue in "Contributing".

AC5. **Record report sent (R2).** The owner clicks "Record report sent". The dialog requires:
- Sent on: date and time, not in the future and not before the resolution time;
- Sent to: an active Customer-context contact of the entity, defaulting to the primary incident contact (for Lloyds Bank plc: Ruth Okafor);
- Channel: Email, Phone, Video call, Chat (as the M22 communication log);
- Report link: optional URL starting with https:// on an approved host (docs.corvane-internal.example), 2,048 characters maximum;
- Summary: 10 to 2,000 characters.

On save the task shows "Root cause report sent 14 Oct 2026 10:20 CEST to Daniel Price by Lukas Brenner (Network)" and leaves the worklist. The entry also appears in the issue's communication log. The server returns 403 to anyone other than the issue owner.

AC6. **Closing and reopening (R2).** The communicator can close the issue while the task is open; the task stays open and visible in the owner's worklist. Reopening the issue keeps the task as it is. A second resolution creates no second task.

AC7. **History and audit (R2).** Task creation and "Record report sent" each write a History event under "Incident", for example "Root cause report sent to Daniel Price (Santander UK plc). By Lukas Brenner, Network.", and audit entries per field (M16).

**Release split:** Release 1: none. Release 2: AC1 to AC7.

**States:**
- **Empty:** issues without a task show no "Root cause report" block, except the AC2 line.
- **Loading:** skeleton of the block; "Record report sent" disabled until loaded.
- **Error:** "Report not recorded. Try again"; the dialog keeps the typed values and nothing is written.
- **Read-only:** everyone except the owner sees the block, the deadline and the sent record with no button.

**Edge cases:**
1. **Severity lowered before resolution.** ISS-1052 goes from Sev-1 to Sev-2 and is then resolved: no task.
2. **Linked issue resolved before the parent.** ISS-1052 resolved by its owner at Sev-1 gets its task at that moment; the later cascade creates no second task.
3. **Card value changed after creation.** Compliance changes Revolut Ltd from 14 to 30 days after the task exists: the deadline stays 19 Oct 2026.
4. **Owner reassigned.** The owner of partner issue ISS-1050 reassigns it within Network (M21 AC8): the linked issues follow the new owner (M23 AC17), and their tasks move with them.
5. **Customer with no active Customer-context contact.** "Sent to" shows "No active customer contact. Add one in Contacts" and the save stays disabled.

**Out of scope (phase 2):**
- Writing or storing the report inside the portal; the portal stores a link only.
- Sending the report from the portal (Gmail API).
- Reminders outside the portal and escalation of overdue tasks (M24).
- Reports for issues below Sev-1 or at customers that are not regulated.

---

### B. Release split summary

| Story | R1 ACs | R2 ACs |
|---|---|---|
| M17 | AC1 to AC13 | none |
| M18 | AC1 to AC11 | AC12 |
| M19 | AC1 to AC9, AC12 to AC15, AC17 to AC20 | AC10, AC11, AC16 |
| M20 | AC1 to AC13 | AC14 |
| M21 | AC1 to AC12 | AC13, AC14 |
| M22 | AC1 to AC12, AC18, AC19 | AC13 to AC17, AC20 |
| M23 | AC1 to AC17 | none |
| M24 | none (phase 2) | none (phase 2) |
| M25 | AC1 to AC8, AC11 | AC9, AC10 |
| M26 | AC1 to AC8, AC10 (the "Post-incident report due (days)" field, its counter and its seed column ship in Release 2) | AC9 |
| M27 | none | AC1 to AC7 |
