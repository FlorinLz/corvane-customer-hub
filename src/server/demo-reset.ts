import type { PrismaClient } from "@prisma/client";

import { seed } from "@seed/seed";

// Every data table except DemoMeta (brief 7.2.3) and Prisma's own
// migrations table.
const TABLES = [
  "AuditEntry", "HistoryEvent", "OwnerAssignment", "ActionItem", "NoteParticipant", "Note",
  "Handoff", "BillingProfile", "ObligationCard", "PeriodicReview", "KybCheck", "Contact",
  "StageEvent", "ContractedProduct", "CoverageStatusChange", "PartnerCoverage", "PartnerRole",
  "VolumeTier", "CustomerRole", "Contract", "EntityBic", "EntityAlias", "Entity", "Group",
  "UserTeamChange", "User",
  // Issue flow (milestone 6A, 3.2.6). TeamBusinessHours has no foreign key
  // to Entity or User, so TRUNCATE ... CASCADE from the rows above would
  // never reach it — it must be named explicitly or a reseed hits a
  // primary-key violation on its `team` row. The rest are named for the
  // same clarity even though CASCADE would already reach them via Entity
  // or User.
  "TeamBusinessHours", "OnCallShift", "IssueTeamMember", "ComplianceAssessment",
  "IssueCommunication", "IssueNote", "IssueContributor", "IssueLink", "IssueResolution",
  "RootCauseReportTask", "Issue", "IssueGroupReport",
];

/**
 * Brief 7.2.3: truncate every data table, reseed with today from
 * src/lib/dates.ts. Runs on the admin client (DATABASE_ADMIN_URL) — the
 * data-level reset used by both the in-app "Reset demo data" action and
 * `npm run demo:reset-data`. Unlike `npm run db:reset`, this never calls
 * `prisma migrate reset`, so it doesn't trigger Prisma's AI-agent consent
 * gate (DECISIONS.md) — safe to run unattended, e.g. from `test:all`.
 */
export async function resetDemoData(db: PrismaClient): Promise<void> {
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`);
  await seed(db); // seed() itself bumps DemoMeta.seedVersion (prisma/seed/seed.ts, Phase 16)
}
