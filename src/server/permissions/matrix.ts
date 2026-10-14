import { Team } from "@prisma/client";

// Brief 4.1.2 "Ownership matrix (single source of truth)" / M15 AC3, as
// updated by decisions P2, P4, D1, D3 and resolutions 33, 36, 38, 47, 48, 52.
// Row grouping and row labels follow the Roles & permissions page
// (several of 4.1.2's
// 30 table rows are shown there as one combined row — e.g. "Roles and
// lifecycle state", "Product lines and target go-live" — since their
// cell values are identical or closely related; this table follows that
// grouping so the rendered page matches it exactly, while every cell
// value still equals 4.1.2). This table exists once in code: can() reads
// it for every server check, UI reads it to render labels, and the
// Roles & permissions admin page renders it directly (M15 AC13) — never
// a copy of its values.

/** E = edit, R = read, add = add-only (History notes), hidden = not rendered + 403, none = no access, admin = isAdmin users of that team only. */
export type Cell = "E" | "R" | "add" | "hidden" | "none" | "admin";

export type DataArea =
  | "customer.create"
  | "entity.core"
  | "entity.rolesAndLifecycle"
  | "customer.contract"
  | "customer.renewal"
  | "customer.handoffSummary"
  | "entity.group"
  | "customer.commercialTerms"
  | "product.lines"
  | "product.stage"
  | "contact.SALES_CS"
  | "contact.OPS"
  | "contact.NETWORK"
  | "contact.FINANCE"
  | "partner.coverage"
  | "partner.agreement"
  | "compliance.kyb"
  | "compliance.obligations"
  | "billing.profile"
  | "history.note"
  | "owner.reassign"
  | "handoff.salesOps"
  | "handoff.opsCs"
  | "audit.read"
  | "admin.softDelete"
  | "admin.usersAndDeleted"
  | "admin.permissions"
  | "issue.report"
  | "issue.owner"
  | "issue.communicator"
  | "issue.compliance";

export type AreaGroup = "Entity" | "Products and onboarding" | "Contacts" | "Partner" | "Compliance" | "Billing" | "Collaboration" | "Admin" | "Issues";

export interface AreaPolicy {
  area: DataArea;
  group: AreaGroup;
  rowLabel: string;
  cells: Record<Team, Cell>;
  cellNotes?: Partial<Record<Team, string>>;
  /** The "Owned by <Team>" label read-only viewers see. Undefined where the brief's label column is "n/a". */
  ownerLabel?: string;
}

const R6 = { SALES: "R", OPS: "R", CS: "R", NETWORK: "R", COMPLIANCE: "R", FINANCE: "R" } as const;
const E6 = { SALES: "E", OPS: "E", CS: "E", NETWORK: "E", COMPLIANCE: "E", FINANCE: "E" } as const;
const NONE6 = { SALES: "none", OPS: "none", CS: "none", NETWORK: "none", COMPLIANCE: "none", FINANCE: "none" } as const;
const HIDDEN6 = { SALES: "hidden", OPS: "hidden", CS: "hidden", NETWORK: "hidden", COMPLIANCE: "hidden", FINANCE: "hidden" } as const;

export const PERMISSION_MATRIX: readonly AreaPolicy[] = [
  // ───────────── Entity ─────────────
  {
    area: "customer.create", group: "Entity", rowLabel: "Create customer (wizard)",
    cells: { ...NONE6, SALES: "E" },
  },
  {
    area: "entity.core", group: "Entity", rowLabel: "Entity core (legal name, aliases, type, country, LEI, BICs)",
    cells: { ...R6, OPS: "E" }, cellNotes: { SALES: "E at creation (wizard)" }, ownerLabel: "Owned by Ops",
  },
  {
    area: "entity.rolesAndLifecycle", group: "Entity", rowLabel: "Roles and lifecycle state (Inactive)",
    cells: { ...R6, OPS: "E" }, ownerLabel: "Owned by Ops",
  },
  {
    area: "customer.contract", group: "Entity", rowLabel: "Customer role: contract reference",
    cells: { ...R6, OPS: "E" }, ownerLabel: "Owned by Ops",
  },
  {
    area: "customer.renewal", group: "Entity", rowLabel: "Customer role: renewal date",
    cells: { ...R6, CS: "E" }, ownerLabel: "Owned by Customer Success",
  },
  {
    area: "customer.handoffSummary", group: "Entity", rowLabel: "Customer role: handoff summary and SLAs",
    cells: { ...R6, SALES: "E" }, ownerLabel: "Owned by Sales",
  },
  {
    area: "entity.group", group: "Entity", rowLabel: "Group structure",
    cells: { ...R6, OPS: "E" }, ownerLabel: "Owned by Ops",
  },

  // ───────────── Products and onboarding ─────────────
  {
    area: "customer.commercialTerms", group: "Products and onboarding", rowLabel: "Commercial terms",
    cells: { ...R6, SALES: "E", FINANCE: "E" }, ownerLabel: "Owned by Sales and Finance",
  },
  {
    area: "product.lines", group: "Products and onboarding", rowLabel: "Product lines and target go-live",
    cells: { ...R6, SALES: "E", OPS: "E" }, ownerLabel: "Owned by Ops",
  },
  {
    area: "product.stage", group: "Products and onboarding", rowLabel: "Onboarding stages and blocks",
    cells: { ...R6, OPS: "E" }, ownerLabel: "Owned by Ops",
  },

  // ───────────── Contacts ─────────────
  {
    area: "contact.SALES_CS", group: "Contacts", rowLabel: "Contacts: Champion, Decision maker (Customer context)",
    cells: { ...R6, SALES: "E", CS: "E" }, ownerLabel: "Owned by Sales and Customer Success",
  },
  {
    area: "contact.OPS", group: "Contacts", rowLabel: "Contacts: Technical, Incident, Escalation (Customer context)",
    cells: { ...R6, OPS: "E" }, ownerLabel: "Owned by Ops",
  },
  {
    area: "contact.NETWORK", group: "Contacts", rowLabel: "Contacts: all roles except Billing (Partner context)",
    cells: { ...R6, NETWORK: "E" }, ownerLabel: "Owned by Network",
  },
  {
    area: "contact.FINANCE", group: "Contacts", rowLabel: "Contacts: Billing",
    cells: { ...R6, FINANCE: "E" }, ownerLabel: "Owned by Finance",
  },

  // ───────────── Partner ─────────────
  {
    area: "partner.coverage", group: "Partner", rowLabel: "Partner coverage and connection method",
    cells: { ...R6, NETWORK: "E" }, ownerLabel: "Owned by Network",
  },
  {
    area: "partner.agreement", group: "Partner", rowLabel: "Partner agreement reference",
    cells: { ...R6, OPS: "E" }, ownerLabel: "Owned by Ops",
  },

  // ───────────── Compliance ─────────────
  {
    area: "compliance.kyb", group: "Compliance", rowLabel: "KYB checks and periodic review",
    cells: { ...R6, COMPLIANCE: "E" }, ownerLabel: "Owned by Compliance",
  },
  {
    area: "compliance.obligations", group: "Compliance", rowLabel: "Contractual obligations",
    cells: { ...R6, COMPLIANCE: "E" }, ownerLabel: "Owned by Compliance",
  },

  // ───────────── Billing ─────────────
  {
    area: "billing.profile", group: "Billing", rowLabel: "Billing profile",
    cells: { ...R6, FINANCE: "E" }, ownerLabel: "Owned by Finance",
  },

  // ───────────── Collaboration ─────────────
  {
    area: "history.note", group: "Collaboration", rowLabel: "History notes",
    cells: { SALES: "add", OPS: "add", CS: "add", NETWORK: "add", COMPLIANCE: "add", FINANCE: "add" },
  },
  {
    area: "owner.reassign", group: "Collaboration", rowLabel: "Owner reassignment",
    cells: { ...R6, CS: "E" }, ownerLabel: "Owned by Customer Success",
  },
  {
    area: "handoff.salesOps", group: "Collaboration", rowLabel: "Handoff Sales → Ops",
    cells: { ...R6, SALES: "E", OPS: "E" },
    cellNotes: { SALES: "E (send, change Onboarding Manager)", OPS: "E (confirm pickup)" },
  },
  {
    area: "handoff.opsCs", group: "Collaboration", rowLabel: "Handoff Ops → CS",
    cells: { ...R6, OPS: "E", CS: "E" },
    cellNotes: { OPS: "E (send, cancel)", CS: "E (accept, decline)" },
  },

  // ───────────── Admin ─────────────
  {
    area: "audit.read", group: "Admin", rowLabel: "Audit log",
    cells: { ...HIDDEN6, COMPLIANCE: "R", OPS: "hidden" },
    cellNotes: { OPS: "hidden (visible to the admin)" },
  },
  {
    area: "admin.softDelete", group: "Admin", rowLabel: "Soft delete and reactivation",
    cells: { ...NONE6, OPS: "admin" },
  },
  {
    area: "admin.usersAndDeleted", group: "Admin", rowLabel: "Users & roles (incl. Change history), Deleted records",
    cells: { ...NONE6, OPS: "admin" },
  },
  {
    area: "admin.permissions", group: "Admin", rowLabel: "Roles & permissions page",
    cells: { ...HIDDEN6, COMPLIANCE: "R", OPS: "hidden" },
    cellNotes: { OPS: "hidden (visible to the admin)" },
  },

  // ───────────── Issues (milestone 6A, 4.1.2 rows 31-34) ─────────────
  {
    area: "issue.report", group: "Issues", rowLabel: "Issues: report, \"Add to existing issue\", issue notes",
    cells: E6,
  },
  {
    area: "issue.owner", group: "Issues", rowLabel: "Issue owner actions (acknowledge, status, resolve, severity, type, contributors, reassign, linked issues)",
    cells: E6,
    cellNotes: { SALES: "E (issue owner only)", OPS: "E (issue owner only)", CS: "E (issue owner only)", NETWORK: "E (issue owner only)", COMPLIANCE: "E (issue owner only)", FINANCE: "E (issue owner only)" },
    ownerLabel: "Only the owner, <name>, can change this issue",
  },
  {
    area: "issue.communicator", group: "Issues", rowLabel: "Issue communicator actions (record notification and update, close, reopen, take over)",
    cells: E6,
    cellNotes: { SALES: "E (current communicator only)", OPS: "E (current communicator only)", CS: "E (current communicator only)", NETWORK: "E (current communicator only)", COMPLIANCE: "E (current communicator only)", FINANCE: "E (current communicator only)" },
  },
  {
    area: "issue.compliance", group: "Issues", rowLabel: "Compliance assessment on an issue",
    cells: { ...R6, COMPLIANCE: "E" }, ownerLabel: "Owned by Compliance",
  },
] as const;

export const MATRIX_BY_AREA: Record<DataArea, AreaPolicy> = Object.fromEntries(
  PERMISSION_MATRIX.map((p) => [p.area, p]),
) as Record<DataArea, AreaPolicy>;

export const MATRIX_GROUPS: AreaGroup[] = ["Entity", "Products and onboarding", "Contacts", "Partner", "Compliance", "Billing", "Collaboration", "Admin", "Issues"];
