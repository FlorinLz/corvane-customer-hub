// Brief 3.3. All enum value -> display label mappings. The UI, audit
// values and History sentences use these labels and never the raw enum
// value.
import {
  ActionItemStatus,
  AssessmentOutcome,
  AuditObjectType,
  AwarenessSource,
  BlockedBy,
  CommunicationChannel,
  CommunicationType,
  CommunicatorRule,
  ConnectionMethod,
  ContactRole,
  ContactStatus,
  ContractScope,
  CoverageStatus,
  CustomerReporterKind,
  EntityType,
  HandoffStatus,
  HandoffType,
  HistoryCategory,
  IssueImpact,
  IssueReporterKind,
  IssueStatus,
  IssueType,
  KybCheckType,
  LeiStatus,
  LifecycleState,
  NoteType,
  ObligationCardKind,
  RegulatoryRegime,
  ReviewStatus,
  RoutingRule,
  SanctionsResult,
  Scheme,
  Severity,
  Stage,
  SchemeAdherence,
  Team,
} from "@prisma/client";

// 3.3.1 Onboarding stages, fixed order.
export const STAGE_ORDER: Stage[] = [
  Stage.CONTRACT_SIGNED,
  Stage.KICKOFF,
  Stage.SANDBOX_TECHNICAL_INTEGRATION,
  Stage.TESTING_CERTIFICATION,
  Stage.UAT,
  Stage.GO_LIVE_APPROVAL,
  Stage.LIVE_HYPERCARE,
  Stage.RAMP_UP,
  Stage.BAU,
];

export const STAGE_LABELS: Record<Stage, string> = {
  CONTRACT_SIGNED: "Contract signed",
  KICKOFF: "Kickoff",
  SANDBOX_TECHNICAL_INTEGRATION: "Sandbox & technical integration",
  TESTING_CERTIFICATION: "Testing & certification",
  UAT: "UAT",
  GO_LIVE_APPROVAL: "Go-live approval",
  LIVE_HYPERCARE: "Live & hypercare",
  RAMP_UP: "Ramp-up",
  BAU: "BAU",
};

export const STAGE_SHORT_LABELS: Record<Stage, string> = {
  CONTRACT_SIGNED: "Contract",
  KICKOFF: "Kickoff",
  SANDBOX_TECHNICAL_INTEGRATION: "Sandbox",
  TESTING_CERTIFICATION: "Testing",
  UAT: "UAT",
  GO_LIVE_APPROVAL: "Approval",
  LIVE_HYPERCARE: "Hypercare",
  RAMP_UP: "Ramp-up",
  BAU: "BAU",
};

// 3.3.2 Value labels.
export const TEAM_LABELS: Record<Team, string> = {
  SALES: "Sales",
  OPS: "Ops",
  CS: "Customer Success",
  NETWORK: "Network",
  COMPLIANCE: "Compliance",
  FINANCE: "Finance",
};

export function ownedByLabel(teams: Team[]): string {
  if (teams.length === 1) return `Owned by ${TEAM_LABELS[teams[0]]}`;
  return `Owned by ${teams.map((t) => TEAM_LABELS[t]).join(" and ")}`;
}

export const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  BANK: "Bank",
  FINTECH: "Fintech",
  PSP: "PSP",
};

export const SCHEME_LABELS: Record<Scheme, string> = {
  EU_VOP: "EU VoP",
  UK_COP: "UK CoP",
  GLOBAL_VALIDATION: "Global validation",
};

export const LEI_STATUS_LABELS: Record<LeiStatus, string> = {
  ISSUED: "Issued",
  LAPSED: "LEI lapsed",
  RETIRED: "Retired",
  MERGED: "Merged",
  ANNULLED: "Annulled",
  DUPLICATE: "Duplicate",
  PENDING_TRANSFER: "Pending transfer",
  PENDING_ARCHIVAL: "Pending archival",
  NOT_VERIFIED: "Not verified with GLEIF",
};

export const LIFECYCLE_LABELS: Record<LifecycleState, string> = {
  ONBOARDING: "Onboarding",
  LIVE: "Live",
  BAU: "BAU",
  INACTIVE: "Inactive",
};

export const BLOCKED_BY_LABELS: Record<BlockedBy, string> = {
  CUSTOMER: "Customer",
  INTERNAL: "Corvane",
  PARTNER: "Partner",
};

export const CONNECTION_METHOD_LABELS: Record<ConnectionMethod, string> = {
  DIRECT: "Direct",
  VIA_SCHEME: "Via scheme",
  VIA_ROUTING_PROVIDER: "Via routing provider",
};

export const COVERAGE_STATUS_LABELS: Record<CoverageStatus, string> = {
  ONBOARDING: "Onboarding",
  ACTIVE: "Active",
  DEGRADED: "Degraded",
  SUSPENDED: "Suspended",
  RETIRED: "Retired",
};

export const CONTRACT_SCOPE_LABELS: Record<ContractScope, string> = {
  ENTITY_CONTRACT: "Entity contract",
  GROUP_MASTER_AGREEMENT: "Group master agreement",
};

export const CONTACT_CONTEXT_LABELS = {
  CUSTOMER: "Customer",
  PARTNER: "Partner",
} as const;

// Contacts tab order (M7 AC11).
export const CONTACT_ROLE_ORDER: ContactRole[] = [
  ContactRole.INCIDENT,
  ContactRole.ESCALATION,
  ContactRole.TECHNICAL,
  ContactRole.CHAMPION,
  ContactRole.DECISION_MAKER,
  ContactRole.BILLING,
];

export const CONTACT_ROLE_LABELS: Record<ContactRole, string> = {
  CHAMPION: "Champion",
  DECISION_MAKER: "Decision maker",
  TECHNICAL: "Technical",
  INCIDENT: "Incident",
  ESCALATION: "Escalation",
  BILLING: "Billing",
};

export const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = {
  ACTIVE: "Active",
  LEFT: "Left",
};

export const KYB_CHECK_TYPE_LABELS: Record<KybCheckType, string> = {
  LICENCE: "Licence",
  LEI: "LEI",
  OWNERSHIP_STRUCTURE: "Ownership structure",
  SANCTIONS_SCREENING: "Sanctions screening",
};

export const SANCTIONS_RESULT_LABELS: Record<SanctionsResult, string> = {
  NO_MATCH: "No match",
  POTENTIAL_MATCH_UNDER_REVIEW: "Potential match under review",
  CONFIRMED_MATCH: "Confirmed match",
};

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  PLANNED: "Planned",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  OVERDUE: "Overdue",
};

export const OBLIGATION_CARD_KIND_LABELS: Record<ObligationCardKind, string> = {
  CUSTOMER_AGREEMENT: "Customer agreement",
  PARTNER_AGREEMENT: "Partner agreement",
};

export const OBLIGATION_ROLE_LABELS: Record<ObligationCardKind, string> = {
  CUSTOMER_AGREEMENT: "Customer",
  PARTNER_AGREEMENT: "Partner",
};

export const SCHEME_ADHERENCE_LABELS: Record<SchemeAdherence, string> = {
  NOT_APPLICABLE: "Not applicable",
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  ADHERED: "Adhered",
  SUSPENDED: "Suspended",
  WITHDRAWN: "Withdrawn",
};

export const HANDOFF_TYPE_LABELS: Record<HandoffType, string> = {
  SALES_TO_OPS: "Sales → Ops",
  OPS_TO_CS: "Ops → CS",
};

export const HANDOFF_STATUS_LABELS: Record<HandoffStatus, string> = {
  SENT: "Sent",
  CONFIRMED: "Confirmed",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  CANCELLED: "Cancelled",
};

export const NOTE_TYPE_LABELS: Record<NoteType, string> = {
  CALL: "Call",
  QBR: "QBR",
  NEGOTIATION: "Negotiation",
  INCIDENT: "Incident",
  PAYMENT: "Payment",
  OTHER: "Other",
};

export const ACTION_ITEM_STATUS_LABELS: Record<ActionItemStatus, string> = {
  OPEN: "Open",
  DONE: "Done",
};

// History event-type filter (M10 AC8). OTHER_FIELD_CHANGES is off by
// default (the R1 server-applied default set, decision in 7.6.3).
export const HISTORY_CATEGORY_LABELS: Record<HistoryCategory, string> = {
  STAGE_CHANGE: "Stage change",
  CONTACT_CHANGE: "Contact change",
  HANDOFF: "Handoff",
  OWNER_REASSIGNED: "Owner reassigned",
  NETWORK_AND_STRUCTURE: "Network and structure",
  OTHER_FIELD_CHANGES: "Other field changes",
  INCIDENT: "Incident",
};

// Brief 3.3.5: the "Incident" filter value stays in the default set (M10 AC8).
export const HISTORY_DEFAULT_CATEGORIES: HistoryCategory[] = [
  HistoryCategory.STAGE_CHANGE,
  HistoryCategory.CONTACT_CHANGE,
  HistoryCategory.HANDOFF,
  HistoryCategory.OWNER_REASSIGNED,
  HistoryCategory.NETWORK_AND_STRUCTURE,
  HistoryCategory.INCIDENT,
];

export const AUDIT_OBJECT_TYPE_LABELS: Record<AuditObjectType, string> = {
  LEGAL_ENTITY: "Legal entity",
  GROUP: "Group",
  CUSTOMER_ROLE: "Customer role",
  PARTNER_ROLE: "Partner role",
  COVERAGE_ROW: "Coverage row",
  CONTRACT: "Contract",
  CONTRACTED_PRODUCT: "Contracted product",
  CONTACT: "Contact",
  KYB_CHECK: "KYB",
  PERIODIC_REVIEW: "Periodic review",
  OBLIGATIONS: "Obligations",
  BILLING_PROFILE: "Billing profile",
  HANDOFF: "Handoff",
  NOTE: "Note",
  ACTION_ITEM: "Action item",
  OWNER_ASSIGNMENT: "Owner",
  USER: "User",
  ISSUE: "Issue", // objectLabel built as "Issue: ISS-1042" at the call site
};

// ───────────── Issue flow (3.3.5) ─────────────

/** Form order as listed (brief 3.3.5, B issue types table). */
export const ISSUE_TYPE_LABELS: Record<IssueType, string> = {
  SERVICE_UNAVAILABLE: "Service unavailable or latency",
  PARTNER_DEGRADED: "Partner degraded or unavailable",
  WRONG_MATCH: "Wrong match result",
  INTEGRATION_BLOCKER: "Integration blocker",
  BILLING: "Billing",
  DATA_BREACH_SECURITY: "Possible data breach or security",
  COMMERCIAL_COVERAGE: "Commercial or coverage",
  OTHER: "Other",
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  SEV1: "Sev-1",
  SEV2: "Sev-2",
  SEV3: "Sev-3",
  SEV4: "Sev-4",
};

/** Badge/chip variant per severity (SEV1 danger/red, SEV2 due/orange, SEV3-4 neutral/grey). */
export const SEVERITY_VARIANT: Record<Severity, "danger" | "due" | "neutral"> = {
  SEV1: "danger",
  SEV2: "due",
  SEV3: "neutral",
  SEV4: "neutral",
};

export const ISSUE_STATUS_LABELS: Record<IssueStatus, string> = {
  NEW: "New",
  IN_PROGRESS: "In progress",
  WAITING_ON_CUSTOMER: "Waiting on customer",
  WAITING_ON_PARTNER: "Waiting on partner",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export const ISSUE_STATUS_VARIANT: Record<IssueStatus, "due-outline" | "neutral-outline" | "neutral" | "success" | "muted"> = {
  NEW: "due-outline",
  IN_PROGRESS: "neutral-outline",
  WAITING_ON_CUSTOMER: "neutral",
  WAITING_ON_PARTNER: "neutral",
  RESOLVED: "success",
  CLOSED: "muted",
};

export const ISSUE_IMPACT_LABELS: Record<IssueImpact, string> = {
  DOWN: "Down",
  DEGRADED: "Degraded",
  ISOLATED_CASE: "Isolated case",
  QUESTION_OR_REQUEST: "Question or request",
};

/** `IssueReporterKind.USER` has no fixed label: render the user's own name and team. */
export const ISSUE_REPORTER_KIND_LABELS: Partial<Record<IssueReporterKind, string>> = {
  MONITORING: "Monitoring (automatic)",
};

export const CUSTOMER_REPORTER_KIND_LABELS: Partial<Record<CustomerReporterKind, string>> = {
  FOUND_INTERNALLY: "Found by Corvane",
  // CONTACT: the contact's own name ("Former contact" once Left); SOMEONE_ELSE: the typed name.
};

/**
 * "Why this owner" / routing audit templates (brief 3.3.5). Each takes
 * the parameters its own sentence needs; `routing.ts` fills them in at
 * routing time and stores the result verbatim in `Issue.routingReason`.
 */
export const ROUTING_RULE_REASON: Record<RoutingRule, (p: { entity?: string; team?: string; parentId?: string; name?: string; date?: string; backup?: string }) => string> = {
  NAMED_PERSON: (p) => `${p.entity}'s named ${p.team} person, inside ${p.team} business hours`,
  ON_CALL_IN_HOURS: (p) => `No named ${p.team} person on this entity: routed to on-call`,
  ON_CALL_OUT_OF_HOURS: (p) => `Outside ${p.team} business hours: routed to the ${p.team} on-call person`,
  QUEUED_FOR_BUSINESS_HOURS: (p) => `${p.entity}'s named ${p.team} person, queued until the start of ${p.team} business hours`,
  INHERITED_FROM_PARENT: (p) => `inherited from partner issue ${p.parentId}`,
  COMPLIANCE_ON_CALL: (p) => `Outside ${p.team} business hours, ${p.team} has no on-call: routed to the Compliance on-call person`,
  BACKUP_FOR_ABSENT: (p) => `${p.name} is absent until ${p.date}: routed to ${p.backup}`,
};

export const COMMUNICATOR_RULE_LABELS: Record<CommunicatorRule, string> = {
  CUSTOMER_OWNER: "Customer owner",
  ISSUE_OWNER_PARTNER: "Issue owner (partner issue)",
  ISSUE_OWNER_UNTIL_HANDOVER: "Issue owner communicates until the customer owner's hours",
  TAKEN_OVER: "Taken over",
};

export const COMMUNICATION_TYPE_LABELS: Record<CommunicationType, string> = {
  FIRST_NOTIFICATION: "First notification",
  UPDATE: "Update",
  FACTS_PACK_SENT: "Facts pack sent",
  BREACH_NOTIFICATION: "Breach notification",
  CLOSURE_CONFIRMED: "Resolution",
  ROOT_CAUSE_REPORT_SENT: "Root cause report",
  SYSTEM: "Customer Hub",
};

/** Times rule 3: the "Source" of Corvane aware at, in the order the Report issue drawer lists them. */
export const AWARENESS_SOURCE_LABELS: Record<AwarenessSource, string> = {
  EMAIL: "Email",
  PHONE: "Phone",
  CHAT: "Chat",
  MONITORING: "Monitoring",
  INTERNAL: "Internal",
};

export const COMMUNICATION_CHANNEL_LABELS: Record<CommunicationChannel, string> = {
  EMAIL: "Email",
  PHONE: "Phone",
  VIDEO_CALL: "Video call",
  CHAT: "Chat",
};

export const ASSESSMENT_OUTCOME_LABELS: Record<AssessmentOutcome, string> = {
  POSSIBLE_MAJOR_INCIDENT: "Possible major incident",
  POSSIBLE_DATA_BREACH: "Possible data breach",
  NEITHER: "Neither",
};

/** `null` displays "Not captured"; "Other" displays "Other: <regime name>" at the call site. */
export const REGULATORY_REGIME_LABELS: Record<RegulatoryRegime, string> = {
  EU_DORA: "EU DORA",
  UK_FCA: "UK FCA",
  UNITED_STATES: "United States",
  SINGAPORE_MAS: "Singapore MAS",
  UAE_CBUAE: "UAE CBUAE",
  OTHER: "Other",
  NONE: "None: not a regulated customer",
};

/** Business-hours chip on the People panel (brief 3.3.5), against the person's own calendar (4.9.3). */
export const BUSINESS_HOURS_CHIP = { IN_HOURS: "In hours", OUT_OF_HOURS: "Out of hours" } as const;

/** "ISS-" + the number padded to 4 digits (brief 3.3.5). */
export function issueDisplayId(number: number): string {
  return `ISS-${String(number).padStart(4, "0")}`;
}
