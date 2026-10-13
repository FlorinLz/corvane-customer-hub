import { daysBetween, formatDate, type LocalDate } from "@/lib/dates";

export type AlertSeverity = "CARMINE" | "MAHOGANY";
export type AlertTab = "products" | "contacts" | "compliance" | "billing" | "details" | "partner";

export interface Alert {
  severity: AlertSeverity;
  text: string;
  opens: AlertTab;
  sortDate: LocalDate | null; // for the "soonest date" tie-break within a severity
}

export interface AlertsInput {
  today: LocalDate;
  blockedProducts: { label: string; blockedBy: "CUSTOMER" | "INTERNAL" | "PARTNER"; since: LocalDate; reason: string }[];
  hasPartnerRole: boolean;
  hasActiveIncidentContact: boolean; // Partner context
  leiInvalid: boolean; // LeiStatus in LAPSED/RETIRED/MERGED/ANNULLED/DUPLICATE
  kybExpired: string[]; // card labels, e.g. "Licence"
  kybExpiring: { label: string; expiryDate: LocalDate }[];
  billingIncomplete: boolean;
  billingMissingCount: number;
  renewalDate: LocalDate | null;
  overdueGoLives: { label: string; targetGoLive: LocalDate }[];
  sanctionsFlagged: "POTENTIAL_MATCH_UNDER_REVIEW" | "CONFIRMED_MATCH" | null;
  reviewOverdue: boolean;
  reviewOverdueSince: LocalDate | null;
  coverageIssues: { label: string; status: "DEGRADED" | "SUSPENDED"; since: LocalDate }[];
  hasActiveChampion: boolean; // Customer context
  championLeftSince: LocalDate | null;
}

const BLOCKED_BY_LABEL: Record<"CUSTOMER" | "INTERNAL" | "PARTNER", string> = {
  CUSTOMER: "Customer",
  INTERNAL: "Corvane",
  PARTNER: "Partner",
};

/** Brief 6.2 "Active alerts": same list for every team, carmine first, then mahogany, then soonest date. */
export function computeAlerts(input: AlertsInput): Alert[] {
  const alerts: Alert[] = [];

  for (const p of input.blockedProducts) {
    alerts.push({
      severity: "CARMINE",
      text: `${p.label} blocked by ${BLOCKED_BY_LABEL[p.blockedBy]} since ${formatDate(p.since)}: ${p.reason}`,
      opens: "products",
      sortDate: p.since,
    });
  }

  if (input.hasPartnerRole && !input.hasActiveIncidentContact) {
    alerts.push({ severity: "CARMINE", text: "No active incident contact", opens: "contacts", sortDate: null });
  }

  if (input.leiInvalid) {
    alerts.push({ severity: "CARMINE", text: "LEI lapsed", opens: "compliance", sortDate: null });
  }

  for (const label of input.kybExpired) {
    alerts.push({ severity: "CARMINE", text: `${label} expired`, opens: "compliance", sortDate: null });
  }

  if (input.billingIncomplete) {
    alerts.push({
      severity: "MAHOGANY",
      text: `Incomplete for billing: ${input.billingMissingCount} field${input.billingMissingCount === 1 ? "" : "s"} missing`,
      opens: "billing",
      sortDate: null,
    });
  }

  if (input.renewalDate && daysBetween(input.today, input.renewalDate) <= 30) {
    const n = daysBetween(input.today, input.renewalDate);
    const text =
      n >= 0
        ? `Renewal on ${formatDate(input.renewalDate)} (in ${n} day${n === 1 ? "" : "s"})`
        : `Renewal on ${formatDate(input.renewalDate)} (${-n} day${-n === 1 ? "" : "s"} ago)`;
    alerts.push({ severity: "MAHOGANY", text, opens: "details", sortDate: input.renewalDate });
  }

  for (const p of input.overdueGoLives) {
    const n = daysBetween(p.targetGoLive, input.today);
    alerts.push({
      severity: "CARMINE",
      text: `${p.label}: Go-live overdue by ${n} day${n === 1 ? "" : "s"}`,
      opens: "products",
      sortDate: p.targetGoLive,
    });
  }

  for (const k of input.kybExpiring) {
    const n = daysBetween(input.today, k.expiryDate);
    alerts.push({
      severity: "MAHOGANY",
      text: `${k.label} expires on ${formatDate(k.expiryDate)} (in ${n} day${n === 1 ? "" : "s"})`,
      opens: "compliance",
      sortDate: k.expiryDate,
    });
  }

  if (input.sanctionsFlagged) {
    const label = input.sanctionsFlagged === "CONFIRMED_MATCH" ? "Confirmed match" : "Potential match under review";
    alerts.push({ severity: "CARMINE", text: `Sanctions screening: ${label}`, opens: "compliance", sortDate: null });
  }

  if (input.reviewOverdue) {
    alerts.push({
      severity: "CARMINE",
      text: `Periodic review overdue since ${formatDate(input.reviewOverdueSince ?? input.today)}`,
      opens: "compliance",
      sortDate: input.reviewOverdueSince,
    });
  }

  for (const c of input.coverageIssues) {
    alerts.push({
      severity: c.status === "SUSPENDED" ? "CARMINE" : "MAHOGANY",
      text: `Partner coverage issue: ${c.label} ${c.status === "SUSPENDED" ? "Suspended" : "Degraded"} since ${formatDate(c.since)}`,
      opens: "partner",
      sortDate: c.since,
    });
  }

  if (!input.hasActiveChampion && input.championLeftSince) {
    alerts.push({
      severity: "MAHOGANY",
      text: `No active champion since ${formatDate(input.championLeftSince)}`,
      opens: "contacts",
      sortDate: input.championLeftSince,
    });
  }

  const severityRank: Record<AlertSeverity, number> = { CARMINE: 0, MAHOGANY: 1 };
  return alerts.sort((a, b) => {
    if (severityRank[a.severity] !== severityRank[b.severity]) return severityRank[a.severity] - severityRank[b.severity];
    if (a.sortDate && b.sortDate) return a.sortDate < b.sortDate ? -1 : a.sortDate > b.sortDate ? 1 : 0;
    if (a.sortDate) return -1;
    if (b.sortDate) return 1;
    return 0;
  });
}
