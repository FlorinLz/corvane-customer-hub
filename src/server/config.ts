// Brief 3.3.4. Reference lists and constants. Grows as later milestones
// need more of them (the worklist window constants, etc.).

import countries from "i18n-iso-countries";
import en from "i18n-iso-countries/langs/en.json";

countries.registerLocale(en);

export const CORVANE_CONTRACTING_ENTITIES = ["Corvane Singapore Pte. Ltd.", "Corvane Europe B.V."] as const;

export const APPROVED_DOC_HOSTS = (process.env.APPROVED_DOC_HOSTS ?? "docs.corvane-internal.example")
  .split(",")
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

// The 27 EU member states; prefix = ISO code except Greece (GR -> EL).
const EU_MEMBER_STATES = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR",
  "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL",
  "PL", "PT", "RO", "SK", "SI", "ES", "SE",
];

export const EU_VAT_PREFIX: Record<string, string> = Object.fromEntries(
  EU_MEMBER_STATES.map((code) => [code, code === "GR" ? "EL" : code]),
);

/** Brief 3.3.4. All ISO 3166-1 alpha-2 codes with English names, shown as "AT Austria". */
export const COUNTRIES: { code: string; name: string }[] = Object.entries(countries.getNames("en", { select: "official" }))
  .map(([code, name]) => ({ code, name }))
  .sort((a, b) => a.name.localeCompare(b.name));

/**
 * Brief 3.3.4, M3 AC2, M5 AC4. Static; the brief notes this should be
 * checked against the EPC's SEPA country list before a real demo.
 */
export const SEPA_COUNTRIES: readonly string[] = [
  "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GR", "HR", "HU", "IE", "IT",
  "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI", "SK", "IS", "LI", "NO", "CH", "GB",
  "MC", "SM", "AD", "VA", "AL", "ME", "MD", "MK", "GI", "GG", "JE", "IM", "AX", "GF", "GP", "MQ",
  "RE", "YT", "PM", "BL", "MF",
];

/** Brief 3.3.4, 3.6.2, M2 AC11. Duplicate check: keep at most this many matches. */
export const DUPLICATE_MAX_MATCHES = 5;

/** Brief 3.3.4, 3.6.2, M2 AC10. Trigram similarity threshold for name matches. */
export function duplicateNameThreshold(): number {
  return Number(process.env.DUPLICATE_NAME_THRESHOLD || 0.85);
}

// ───────────── Issue flow (3.3.6) ─────────────
// TEAM_TIME_ZONES and TZ_ABBREVIATIONS live in src/lib/business-hours.ts
// and src/lib/time-zones.ts instead of here: those modules must stay
// importable client-side (the 6B report form imports business-hours.ts
// directly), and src/server/* is server-only by this project's own
// layering convention. See DECISIONS.md.

import type { IssueStatus, IssueType, Severity, Team } from "@prisma/client";

/** Brief 3.3.6, M18 AC2, AC8. Owner team from the type (rule 1); default contributor team (rule 5). */
export const ISSUE_TYPE_ROUTING: Record<IssueType, { owner: Team; contributor: Team | null }> = {
  SERVICE_UNAVAILABLE: { owner: "OPS", contributor: null },
  PARTNER_DEGRADED: { owner: "NETWORK", contributor: "OPS" },
  WRONG_MATCH: { owner: "OPS", contributor: "NETWORK" },
  INTEGRATION_BLOCKER: { owner: "OPS", contributor: null },
  BILLING: { owner: "FINANCE", contributor: "SALES" },
  DATA_BREACH_SECURITY: { owner: "COMPLIANCE", contributor: "OPS" },
  COMMERCIAL_COVERAGE: { owner: "SALES", contributor: "NETWORK" },
  OTHER: { owner: "OPS", contributor: null },
};

// SEVERITY_FROM_IMPACT and TYPE_SEVERITY_CAP (3.3.6, M17 AC7, AC9, B26)
// live in src/server/derived/severity.ts instead of here: proposeSeverity()
// must stay importable client-side (the 6B report drawer imports it
// directly for the live proposal, 4.9.1), and this file pulls in
// i18n-iso-countries at module load -- exactly the kind of accidental
// client bundle src/lib/validation/bic.ts's own comment warns against.
// See DECISIONS.md.

/** Brief 3.3.6, M19 AC4. Acknowledge target per severity. */
export const ACK_TARGET: Record<Severity, { minutes: number; business: boolean }> = {
  SEV1: { minutes: 15, business: false },
  SEV2: { minutes: 60, business: false },
  SEV3: { minutes: 540, business: true }, // 1 business day
  SEV4: { minutes: 1620, business: true }, // 3 business days
};

/** Brief 3.3.6, M19 AC5. Sev-2 notification target, business minutes of the communicator. Sev-1 reads the Customer agreement card (or the 2h default); Sev-3/4 have none. */
export const NOTIFY_TARGET_SEV2_BUSINESS_MINUTES = 240;
export const NOTIFY_TARGET_SEV1_DEFAULT_HOURS = 2;

/** Brief 3.3.6, M25 AC5. Compliance assessment countdown while the flagged issue is Sev-1. */
export const COMPLIANCE_ASSESS_MINUTES = 60;

/** Brief 3.3.6, B30. 1 business day. */
export const BUSINESS_DAY_MINUTES = 540;

/** Brief 3.3.6, B19. Teams with an on-call rota. */
export const ON_CALL_TEAMS: Team[] = ["OPS", "NETWORK", "COMPLIANCE"];

/** Brief 3.3.6, B18. Sales person fallback when the named Sales person is inactive. */
export const SALES_DIRECTOR_EMAIL = "tom.hadley@corvane.example";

/** Brief 3.3.6, B18, 7.1.17.3. Issue team defaults; SALES is the creating Sales user, not a fixed default. */
export const ISSUE_TEAM_DEFAULTS: Record<"OPS" | "NETWORK" | "COMPLIANCE" | "FINANCE", string> = {
  OPS: "adrian.koh@corvane.example",
  NETWORK: "lukas.brenner@corvane.example",
  COMPLIANCE: "mei.chen@corvane.example",
  FINANCE: "rachel.wong@corvane.example",
};

/** Brief 3.3.6, M19 AC12, M20 AC10. */
export const ISSUES_REFRESH_SECONDS = 60;

/** Brief 3.3.6, M19 AC13. Severity, type, back-to-work and reassign reasons. Unlink is 5 to 500, its own schema. */
export const ISSUE_REASON_LENGTH = { min: 10, max: 500 };

/** Brief 4.9.10, M22 AC5. window.open target; `to`, `su`, `body` appended by gmailComposeUrl(). */
export const GMAIL_COMPOSE_URL = "https://mail.google.com/mail/?view=cm&fs=1";

/** Brief 4.9.10, M22 AC3, R2 AC14. Update cadence by severity; Sev-3/Sev-4 have none ("Next update: when the status changes"). */
export const UPDATE_INTERVAL_MINUTES: Partial<Record<Severity, number>> = {
  SEV1: 120,
  SEV2: 480,
};

/**
 * Brief M17 AC5, AC6. "Open" for the similar-issues block and "Add to
 * existing issue" -- narrower than the B conventions' general "open in
 * every status except Closed" (used for the open-issues chip and the
 * Issues tab "Open" filter, decision in DECISIONS.md): these two ACs
 * list the 4 statuses explicitly and exclude Resolved, since a Resolved
 * issue is done except for the customer close.
 */
export const ISSUE_OPEN_FOR_SIMILAR: IssueStatus[] = ["NEW", "IN_PROGRESS", "WAITING_ON_CUSTOMER", "WAITING_ON_PARTNER"];

/**
 * Brief 4.6.1. Worklist engine (M11) thresholds, no admin screen. R1 reads
 * only the first five; the rest exist for the R2 "Waiting <n> days" pin
 * and the Network/Finance R2 sections, kept here as one object per the
 * brief's own sketch.
 */
export const WORKLIST = {
  STAGE_LIMIT_DAYS_EARLY: 21,
  STAGE_LIMIT_DAYS_HYPERCARE: 56,
  GO_LIVE_WINDOW_DAYS: 14,
  RENEWAL_WINDOW_DAYS: 120,
  EXPIRY_WINDOW_DAYS: 90,
  PARTNER_CONTACT_STALE_DAYS: 90,
  BILLING_CONTACT_STALE_MONTHS: 6,
  STALE_HANDOFF_BUSINESS_DAYS: 2,
} as const;

/**
 * Interactive transactions (every write goes through one). Prisma's own defaults are 5 s to run and 2 s to wait for a
 * connection; a database a network hop away (Neon from Vercel) answers each statement in tens of milliseconds, so a
 * write that issues dozens of statements one after another used to cross 5 s (P2028 "expired transaction"). The real fix
 * is to issue few statements (batch the rows, read once); this is only the safety margin around it.
 */
export const TRANSACTION_OPTIONS = { timeout: 15_000, maxWait: 5_000 } as const;
