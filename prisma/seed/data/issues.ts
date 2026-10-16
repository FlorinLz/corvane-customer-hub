// Brief 7.1.17.5. The seed issues: the three original ones (ISS-1031, ISS-1038, ISS-1042) and the fuller
// Home worklists for the demo (ISS-1020 to ISS-1030, below). Severity, routing, compliance
// flagging and the acknowledge/notification clock due times are derived in
// seed.ts from these facts with the same pure functions the live code uses
// (`proposeSeverity`, `routeIssue`, `complianceReasons`, `addBusinessMinutes`),
// so the seed can never drift from production behaviour. Only genuinely
// historical facts (who acknowledged, when, the note and communication
// text, the compliance assessment) are literal here.
export interface SeedIssueTime {
  offsetDays: number;
  time: string;
  zone: string;
}

export interface SeedIssueNote {
  authorKey: string;
  body: string;
  at: SeedIssueTime;
}

export interface SeedIssueCommunication {
  type: "FIRST_NOTIFICATION" | "UPDATE" | "FACTS_PACK_SENT";
  channel: "EMAIL" | "PHONE";
  contactEntityKey: string;
  contactName: string;
  recordedByKey: string;
  message: string;
  /** When it was recorded. Default: the issue's notifiedAt (the first notification). */
  at?: SeedIssueTime;
}

export interface SeedComplianceAssessment {
  outcome: "POSSIBLE_MAJOR_INCIDENT" | "POSSIBLE_DATA_BREACH" | "NEITHER";
  rationale: string;
  assessedByKey: string;
  at: SeedIssueTime;
  factsTargetHours: number | null;
}

export interface SeedIssue {
  displayId: string; // comment-only, e.g. "ISS-1031" -- must match issueDisplayId(number)
  // Explicit, not sequence-generated: the seed inserts 1031/1038/1042 directly, then runs
  // `setval('issue_number_seq', 1042)` afterward so the next live report is ISS-1043 (7.1.17.5).
  number: number;
  // "wtsz": every SeedIssueTime below resolves its date with wd() first (brief 7.1.17: the
  // issue's own calendar day must be a weekday). "tsz": the plain calendar date, no weekday skip
  // (ISS-1042 is deliberately "the evening before", which may be a Saturday or Sunday).
  dateKind: "tsz" | "wtsz";
  entityKey: string;
  productKey: string | null;
  scheme: "EU_VOP" | "UK_COP" | "GLOBAL_VALIDATION" | null;
  country: string | null;
  type: "SERVICE_UNAVAILABLE" | "WRONG_MATCH" | "BILLING" | "PARTNER_DEGRADED" | "COMMERCIAL_COVERAGE" | "OTHER";
  /** A partner issue ("Partner degraded or unavailable" on a partner coverage): owner Network, the owner is also the communicator, no notification clock. */
  partner?: boolean;
  /** Partner issues of the fuller worklists leave the type's default contributor (Ops) out, so the named Ops person's Home stays on the issues that are theirs. */
  noDefaultContributor?: boolean;
  /** Flagged for Compliance with no assessment yet: the entity's Compliance person is assigned and has an open "Assess for Compliance" step. */
  assignComplianceAssessor?: boolean;
  impact: "DOWN" | "DEGRADED" | "ISOLATED_CASE";
  possibleBreach: boolean;
  description: string;
  awareAt: SeedIssueTime;
  /** Event ("when the problem started"), minutes before Corvane aware at; null = Unknown (never on a resolved Sev-1). */
  eventMinutesBeforeAware: number | null;
  awarenessSource: "EMAIL" | "PHONE" | "CHAT" | "MONITORING" | "INTERNAL";
  savedAt: SeedIssueTime; // createdAt, clocksStartAt, ackStartAt
  reporterKind: "USER" | "MONITORING";
  reporterKey: string | null;
  customerReporterKind: "FOUND_INTERNALLY" | "CONTACT";
  customerReporterEntityKey: string | null;
  customerReporterContactName: string | null;
  /** null = not acknowledged yet (status New, the acknowledge deadline is still ahead or already passed). */
  acknowledgedAt: SeedIssueTime | null;
  acknowledgedByKey: string | null;
  notifiedAt: SeedIssueTime | null;
  /** The owner recorded "Service restored" (the deadline model): when, by whom, and the note. */
  restoredAt?: SeedIssueTime | null;
  restoredByKey?: string | null;
  restoreNote?: string | null;
  notes: SeedIssueNote[];
  communications: SeedIssueCommunication[];
  complianceAssessment: SeedComplianceAssessment | null;
}

const AMS = "Europe/Amsterdam";
const at = (offsetDays: number, time: string, zone: string = AMS): SeedIssueTime => ({ offsetDays, time, zone });

/** An issue of the fuller worklists: weekday-relative to the demo clock (offset 0 = demo day, -1 = the weekday before), times in CEST. */
function worklistIssue(i: Partial<SeedIssue> & Pick<SeedIssue, "displayId" | "number" | "entityKey" | "type" | "impact" | "description" | "awareAt" | "savedAt" | "reporterKey">): SeedIssue {
  return {
    dateKind: "wtsz",
    productKey: null,
    scheme: null,
    country: null,
    possibleBreach: false,
    eventMinutesBeforeAware: null,
    awarenessSource: "EMAIL",
    reporterKind: "USER",
    customerReporterKind: "FOUND_INTERNALLY",
    customerReporterEntityKey: null,
    customerReporterContactName: null,
    acknowledgedAt: null,
    acknowledgedByKey: null,
    notifiedAt: null,
    notes: [],
    communications: [],
    complianceAssessment: null,
    ...i,
  };
}

const contact = (entityKey: string, name: string) => ({ customerReporterKind: "CONTACT" as const, customerReporterEntityKey: entityKey, customerReporterContactName: name });

export const ISSUES: SeedIssue[] = [
  {
    displayId: "ISS-1031",
    number: 1031,
    dateKind: "wtsz",
    entityKey: "hvb",
    productKey: null,
    scheme: null,
    country: null,
    type: "BILLING",
    impact: "ISOLATED_CASE",
    possibleBreach: false,
    description: "Claudia Schulz reports that the Q3 invoice shows no PO number and the wrong VAT ID. HVB asks for a corrected invoice before payment.",
    awareAt: { offsetDays: -2, time: "10:40", zone: "Asia/Singapore" },
    eventMinutesBeforeAware: 20,
    awarenessSource: "EMAIL",
    savedAt: { offsetDays: -2, time: "11:00", zone: "Asia/Singapore" },
    reporterKind: "USER",
    reporterKey: "rachel",
    customerReporterKind: "CONTACT",
    customerReporterEntityKey: "hvb",
    customerReporterContactName: "Claudia Schulz",
    acknowledgedAt: { offsetDays: -2, time: "11:30", zone: "Asia/Singapore" },
    acknowledgedByKey: "rachel",
    notifiedAt: null,
    notes: [
      {
        authorKey: "tom",
        body: "Andreea has the Q4 PO number. I asked her to send it with her confirmation.",
        at: { offsetDays: -2, time: "09:30", zone: "Europe/Amsterdam" },
      },
    ],
    communications: [],
    complianceAssessment: null,
  },
  {
    displayId: "ISS-1038",
    number: 1038,
    dateKind: "wtsz",
    entityKey: "revolut",
    productKey: "P15",
    scheme: "UK_COP",
    country: "GB",
    type: "WRONG_MATCH",
    impact: "DEGRADED",
    possibleBreach: false,
    description: "Payee 'J Smith Plumbing Ltd' returns No match for the trading name 'Smith Plumbing'. 14 cases so far.",
    // 14:45, 35 min before it was opened (15:20): the Timeline shows the amber gap marker on this Sev-2 issue. Acknowledge 50 of 60 min and notify 85 of 240 business min stay on time.
    awareAt: { offsetDays: -3, time: "14:45", zone: "Asia/Kuala_Lumpur" },
    eventMinutesBeforeAware: 20,
    awarenessSource: "EMAIL",
    savedAt: { offsetDays: -3, time: "15:20", zone: "Asia/Kuala_Lumpur" },
    reporterKind: "USER",
    reporterKey: "adrian",
    customerReporterKind: "CONTACT",
    customerReporterEntityKey: "revolut",
    customerReporterContactName: "Priya Nair",
    acknowledgedAt: { offsetDays: -3, time: "15:35", zone: "Asia/Kuala_Lumpur" },
    acknowledgedByKey: "kevin",
    notifiedAt: { offsetDays: -3, time: "16:10", zone: "Asia/Kuala_Lumpur" },
    notes: [
      {
        authorKey: "lukas",
        body: "The responding bank matches on legal names only. Raised with its service desk; they are checking trading name support.",
        at: { offsetDays: -3, time: "16:30", zone: "Asia/Singapore" },
      },
    ],
    communications: [
      {
        type: "FIRST_NOTIFICATION",
        channel: "EMAIL",
        contactEntityKey: "revolut",
        contactName: "Priya Nair",
        recordedByKey: "kevin",
        message: "First notification to Priya Nair: ISS-1038 affects wrong-match results for Revolut Ltd on UK CoP GB. Our Ops team is working with the responding bank on trading-name support.",
      },
      {
        type: "UPDATE",
        channel: "EMAIL",
        contactEntityKey: "revolut",
        contactName: "Priya Nair",
        recordedByKey: "adrian",
        at: at(-1, "11:00", "Asia/Kuala_Lumpur"),
        message: "Update to Priya Nair on ISS-1038: the responding bank confirmed it matches on legal names only and is checking trading-name support. 14 cases so far, no new ones since yesterday.",
      },
      {
        type: "UPDATE",
        channel: "EMAIL",
        contactEntityKey: "revolut",
        contactName: "Priya Nair",
        recordedByKey: "adrian",
        at: at(0, "13:45", "Asia/Kuala_Lumpur"),
        message: "Update to Priya Nair on ISS-1038: the responding bank plans trading-name support for its next release. We keep logging new cases and will tell you when a date is confirmed.",
      },
    ],
    complianceAssessment: null,
  },
  {
    displayId: "ISS-1042",
    number: 1042,
    dateKind: "tsz",
    entityKey: "mps",
    productKey: "P9",
    scheme: "EU_VOP",
    country: "IT",
    type: "SERVICE_UNAVAILABLE",
    impact: "DOWN",
    possibleBreach: false,
    description: "Monitoring alert: every EU VoP request for Banca Monte dei Paschi di Siena S.p.A. (IT) times out. Error rate 100 % over 2 minutes.",
    awareAt: { offsetDays: -1, time: "21:12", zone: "Europe/Amsterdam" },
    eventMinutesBeforeAware: 2, // the alert start; Corvane aware at is the alert time
    awarenessSource: "MONITORING",
    savedAt: { offsetDays: -1, time: "21:12", zone: "Europe/Amsterdam" },
    reporterKind: "MONITORING",
    reporterKey: null,
    customerReporterKind: "FOUND_INTERNALLY",
    customerReporterEntityKey: null,
    customerReporterContactName: null,
    acknowledgedAt: { offsetDays: -1, time: "21:21", zone: "Europe/Amsterdam" },
    acknowledgedByKey: "kevin",
    notifiedAt: { offsetDays: -1, time: "22:05", zone: "Europe/Amsterdam" },
    notes: [
      {
        authorKey: "kevin",
        body: "Endpoint certificate for EU VoP IT expired after the rotation job failed. Renewing it now.",
        at: { offsetDays: -1, time: "21:40", zone: "Europe/Amsterdam" },
      },
    ],
    // The service came back at night: the certificate was renewed at 22:30. Kevin kept MPS up to date (every 60 min before the restore, every 4 h after it),
    // and sent the facts for MPS's regulator within the 2 h the contract gives. The last update was at 06:30, so the next is due at 10:30.
    restoredAt: at(-1, "22:30"),
    restoredByKey: "kevin",
    restoreNote: "Endpoint certificate renewed. Name checks are answering again; Ops keeps watching the endpoint.",
    communications: [
      {
        type: "FIRST_NOTIFICATION",
        channel: "EMAIL",
        contactEntityKey: "mps",
        contactName: "Silvia Moretti",
        recordedByKey: "kevin",
        message: "First notification to Silvia Moretti: ISS-1042 is affecting every EU VoP request for Banca Monte dei Paschi di Siena S.p.A. Our Ops team is renewing the expired endpoint certificate now.",
      },
      {
        type: "FACTS_PACK_SENT",
        channel: "EMAIL",
        contactEntityKey: "mps",
        contactName: "Silvia Moretti",
        recordedByKey: "kevin",
        at: at(-1, "22:40"),
        message: "Facts for MPS's regulator on ISS-1042: every EU VoP request failed from 21:10 CEST because the endpoint certificate expired; about 100 % of requests were affected until 22:30; the certificate was renewed and the service restored. Compliance assessed a possible major incident at 21:58.",
      },
      {
        type: "UPDATE",
        channel: "EMAIL",
        contactEntityKey: "mps",
        contactName: "Silvia Moretti",
        recordedByKey: "kevin",
        at: at(-1, "23:00"),
        message: "Update to Silvia Moretti on ISS-1042: the endpoint certificate is renewed and EU VoP is answering again. Ops keeps watching the error rate. Next update in 4 hours.",
      },
      {
        type: "UPDATE",
        channel: "EMAIL",
        contactEntityKey: "mps",
        contactName: "Silvia Moretti",
        recordedByKey: "kevin",
        at: at(0, "02:30"),
        message: "Update to Silvia Moretti on ISS-1042: error rate has stayed at 0 % since 22:30. We keep monitoring and will confirm the cause in the root cause report.",
      },
      {
        type: "UPDATE",
        channel: "EMAIL",
        contactEntityKey: "mps",
        contactName: "Silvia Moretti",
        recordedByKey: "kevin",
        at: at(0, "06:30"),
        message: "Update to Silvia Moretti on ISS-1042: no failed requests overnight. The rotation job is being repaired so the certificate renews itself next time.",
      },
    ],
    complianceAssessment: {
      outcome: "POSSIBLE_MAJOR_INCIDENT",
      rationale: "EU VoP is down for a DORA bank: MPS may classify this as a major ICT incident.",
      assessedByKey: "mei",
      at: { offsetDays: -1, time: "21:58", zone: "Europe/Amsterdam" },
      factsTargetHours: 2,
    },
  },
  // ───── Fuller Home worklists for the demo (demo clock Mon 05 Oct 2026, about 10:05 CEST) ─────
  // Nothing here touches UK CoP / GB, Revolut Ltd, Lloyds Bank plc, Santander UK, Zopa or Banca Monte dei
  // Paschi di Siena, and no partner coverage changes status. Deadlines count from Corvane aware at: Sev-1 15 min,
  // Sev-2 60 business min, Sev-3 one business day (540 min) in the owner's calendar.

  // Network, partner issues (Lukas Brenner owns and communicates). Acknowledged on Friday, in progress.
  worklistIssue({
    displayId: "ISS-1020", number: 1020, entityKey: "ingdiba", scheme: "EU_VOP", country: "DE", type: "PARTNER_DEGRADED", partner: true, noDefaultContributor: true,
    impact: "DEGRADED", description: "ING-DiBa's EU VoP endpoint rejects name checks that contain umlauts; its service desk has confirmed an encoding fault and is testing a fix.",
    // Friday 11:00 CEST (17:00 Singapore): the Network clocks start on Monday morning. Restore is due Monday 17:00 Singapore (11:00 CEST).
    awareAt: at(-1, "11:00"), savedAt: at(-1, "11:05"), eventMinutesBeforeAware: 30, awarenessSource: "INTERNAL", reporterKey: "lukas",
    acknowledgedAt: at(-1, "11:20"), acknowledgedByKey: "lukas", notifiedAt: at(-1, "11:45"),
    notes: [{ authorKey: "lukas", body: "ING-DiBa confirmed the encoding fault on their side. A fix is planned for their next release window.", at: at(-1, "12:30") }],
    // Lukas chases the partner: the clock (every 4 business hours at Sev-2) restarts at each contact. The last one was Monday 12:30 Singapore, so the next is due at 16:30.
    communications: [
      {
        type: "FIRST_NOTIFICATION", channel: "PHONE", contactEntityKey: "ingdiba", contactName: "Jonas Weber", recordedByKey: "lukas",
        message: "First contact with Jonas Weber on ISS-1020: EU VoP name checks with umlauts are rejected. He confirmed an encoding fault and is testing a fix.",
      },
      {
        type: "UPDATE", channel: "EMAIL", contactEntityKey: "ingdiba", contactName: "Jonas Weber", recordedByKey: "lukas", at: at(0, "06:30"),
        message: "Chase to Jonas Weber on ISS-1020: is the encoding fix still planned for the next release window? Please send a date.",
      },
    ],
  }),
  // Customer Success: billing, Finance owns. Acknowledge deadline passed on Monday 09:35 (Finance calendar, 1 business day).
  worklistIssue({
    displayId: "ISS-1021", number: 1021, entityKey: "scbIt", type: "BILLING", impact: "ISOLATED_CASE",
    description: "Federica Rinaldi asks for a credit note: the Global validation UAT line was billed at the live rate.",
    awareAt: at(-1, "09:35"), savedAt: at(-1, "09:40"), reporterKey: "emma", ...contact("scbIt", "Federica Rinaldi"),
  }),
  // Operations: Totta (Adrian Koh is the customer owner and the Ops person). Finance owns; acknowledge deadline Monday 09:45.
  worklistIssue({
    displayId: "ISS-1022", number: 1022, entityKey: "totta", type: "BILLING", impact: "ISOLATED_CASE",
    description: "Inês Carvalho reports that the September usage statement lists the wrong product lines and asks for a corrected invoice.",
    awareAt: at(-1, "09:45"), savedAt: at(-1, "09:50"), reporterKey: "adrian", ...contact("totta", "Inês Carvalho"),
  }),
  // Sales owns; acknowledge deadline Monday 10:25, 20 minutes into the demo.
  worklistIssue({
    displayId: "ISS-1023", number: 1023, entityKey: "totta", type: "COMMERCIAL_COVERAGE", impact: "ISOLATED_CASE",
    description: "Inês Carvalho asks whether EU VoP can be extended to Spanish accounts and what that would cost.",
    awareAt: at(-1, "10:25"), savedAt: at(-1, "10:30"), reporterKey: "adrian", ...contact("totta", "Inês Carvalho"),
  }),
  // Finance owns; acknowledge deadline Monday 10:40, 35 minutes into the demo.
  worklistIssue({
    displayId: "ISS-1024", number: 1024, entityKey: "hvb", type: "BILLING", impact: "ISOLATED_CASE",
    description: "Markus Wolf asks to change the invoice address on the Q4 invoice before it is issued.",
    awareAt: at(-1, "10:40"), savedAt: at(-1, "10:45"), reporterKey: "emma", ...contact("hvb", "Markus Wolf"),
  }),
  // Operations: Sev-2, acknowledged on time; the customer is told; Ops investigates.
  worklistIssue({
    displayId: "ISS-1025", number: 1025, entityKey: "nordea", productKey: "P19", scheme: "EU_VOP", country: "FI", type: "SERVICE_UNAVAILABLE", impact: "DEGRADED",
    description: "Juha Nieminen reports that about a third of EU VoP name checks to Finnish banks time out.",
    awareAt: at(0, "08:15"), savedAt: at(0, "08:20"), eventMinutesBeforeAware: 10, reporterKey: "sophie", awarenessSource: "PHONE", ...contact("nordea", "Juha Nieminen"),
    acknowledgedAt: at(0, "08:50"), acknowledgedByKey: "adrian", notifiedAt: at(0, "09:35"),
    notes: [{ authorKey: "adrian", body: "The timeouts only affect Finnish destination banks. Checking the routing table for the FI range.", at: at(0, "09:00") }],
    communications: [{
      type: "FIRST_NOTIFICATION", channel: "EMAIL", contactEntityKey: "nordea", contactName: "Juha Nieminen", recordedByKey: "sophie",
      message: "First notification to Juha Nieminen: ISS-1025 is slowing EU VoP name checks to Finnish banks for Nordea Bank Abp. Our Ops team is checking the routing for that range.",
    }],
  }),
  // Network, partner issue: acknowledge deadline Monday 09:30, passed.
  worklistIssue({
    displayId: "ISS-1026", number: 1026, entityKey: "adyen", scheme: "GLOBAL_VALIDATION", country: "NL", type: "PARTNER_DEGRADED", partner: true, noDefaultContributor: true,
    impact: "DEGRADED", description: "ClearRoute Services reports intermittent timeouts on Global validation requests for Adyen N.V. (NL): about one in five fails.",
    awareAt: at(0, "08:30"), savedAt: at(0, "08:35"), eventMinutesBeforeAware: 20, awarenessSource: "INTERNAL", reporterKey: "lukas",
  }),
  // Operations Sev-1 at a DORA bank: acknowledged in 10 minutes, customer notified, Compliance still to assess.
  worklistIssue({
    displayId: "ISS-1029", number: 1029, entityKey: "hvb", productKey: "P13", scheme: "EU_VOP", country: "DE", type: "SERVICE_UNAVAILABLE", impact: "DOWN",
    description: "Markus Wolf reports that every EU VoP request returns HTTP 503 and that customer payments are blocked.",
    awareAt: at(0, "09:25"), savedAt: at(0, "09:27"), eventMinutesBeforeAware: 7, reporterKey: "emma", awarenessSource: "PHONE", ...contact("hvb", "Markus Wolf"),
    acknowledgedAt: at(0, "09:35"), acknowledgedByKey: "adrian", notifiedAt: at(0, "09:55"), assignComplianceAssessor: true,
    notes: [{ authorKey: "adrian", body: "The load balancer in front of the DE endpoint is returning 503. Restarting the pool and watching the error rate.", at: at(0, "09:40") }],
    communications: [{
      type: "FIRST_NOTIFICATION", channel: "PHONE", contactEntityKey: "hvb", contactName: "Markus Wolf", recordedByKey: "emma",
      message: "First notification to Markus Wolf: ISS-1029 is blocking EU VoP requests for UniCredit Bank GmbH. Our Ops team is restarting the load balancer pool.",
    }],
  }),
  // Network, partner issue: Sev-3, acknowledge deadline tomorrow 09:10.
  worklistIssue({
    displayId: "ISS-1027", number: 1027, entityKey: "boi", scheme: "GLOBAL_VALIDATION", country: "IE", type: "PARTNER_DEGRADED", partner: true, noDefaultContributor: true,
    impact: "ISOLATED_CASE", description: "Bank of Ireland returns 'account not found' for one closed-account lookup through ClearRoute; no pattern yet.",
    awareAt: at(0, "09:10"), savedAt: at(0, "09:12"), awarenessSource: "INTERNAL", reporterKey: "lukas",
  }),
  // Operations: Sev-3 question, acknowledge deadline tomorrow 09:20.
  worklistIssue({
    displayId: "ISS-1028", number: 1028, entityKey: "scbIt", type: "OTHER", impact: "ISOLATED_CASE",
    description: "Marco Bellini asks how to add a second technical contact for the EU VoP line in the portal.",
    awareAt: at(0, "09:20"), savedAt: at(0, "09:25"), reporterKey: "emma", ...contact("scbIt", "Marco Bellini"),
  }),
  // Network, partner issue: acknowledge deadline Monday 10:30, 25 minutes into the demo.
  worklistIssue({
    displayId: "ISS-1030", number: 1030, entityKey: "ocbc", scheme: "GLOBAL_VALIDATION", country: "SG", type: "PARTNER_DEGRADED", partner: true, noDefaultContributor: true,
    impact: "DEGRADED", description: "OCBC's Global validation endpoint answers slowly: the median response time is 4 seconds against the usual 600 milliseconds.",
    awareAt: at(0, "09:30"), savedAt: at(0, "09:32"), eventMinutesBeforeAware: 15, awarenessSource: "INTERNAL", reporterKey: "lukas",
  }),
];
