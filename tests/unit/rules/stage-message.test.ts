import { describe, expect, it } from "vitest";

import { buildStageMessage, customerFacingStatus, selectStage, type StageInput, type StageMessageInput } from "@/server/issues/stage-message";

// Stage-aware message to the customer: which template an issue's state picks, and what each says.
const base: StageInput = { status: "IN_PROGRESS", notified: false, isPartnerIssue: false, reportReadyToSend: false, viewerIsOwner: false };

describe("which template the panel shows", () => {
  it("customer issue: first notification, then update once one is recorded, then resolution once Resolved", () => {
    expect(selectStage({ ...base })).toBe("FIRST_NOTIFICATION");
    expect(selectStage({ ...base, status: "NEW" })).toBe("FIRST_NOTIFICATION");
    expect(selectStage({ ...base, notified: true })).toBe("UPDATE");
    expect(selectStage({ ...base, notified: true, status: "WAITING_ON_CUSTOMER" })).toBe("UPDATE");
    expect(selectStage({ ...base, notified: true, status: "RESOLVED" })).toBe("RESOLUTION");
    expect(selectStage({ ...base, status: "RESOLVED" })).toBe("RESOLUTION"); // resolved with no notification ever recorded
    expect(selectStage({ ...base, notified: true, status: "CLOSED" })).toBe("RESOLUTION"); // read-only once closed
  });

  it("the root cause report template is the owner's, once Compliance approved the draft and the report is not sent; everyone else keeps the resolution", () => {
    const resolved = { ...base, status: "RESOLVED" as const, notified: true, reportReadyToSend: true };
    expect(selectStage({ ...resolved, viewerIsOwner: true })).toBe("REPORT");
    expect(selectStage({ ...resolved, viewerIsOwner: false })).toBe("RESOLUTION"); // the communicator closes with the customer
    expect(selectStage({ ...resolved, viewerIsOwner: true, reportReadyToSend: false })).toBe("RESOLUTION"); // not approved yet, or already sent
  });

  it("partner issue: the same first notification, update and resolution, never the report", () => {
    const partner = { ...base, isPartnerIssue: true };
    expect(selectStage(partner)).toBe("FIRST_NOTIFICATION");
    expect(selectStage({ ...partner, notified: true })).toBe("UPDATE");
    expect(selectStage({ ...partner, status: "RESOLVED" })).toBe("RESOLUTION");
    expect(selectStage({ ...partner, status: "RESOLVED", reportReadyToSend: true, viewerIsOwner: true })).toBe("RESOLUTION");
  });
});

const PREPARED = new Date("2026-10-05T08:48:00Z");
const input = (over: Partial<StageMessageInput> = {}): StageMessageInput => ({
  issue: {
    number: 1046, type: "PARTNER_DEGRADED", scheme: "UK_COP", country: "GB", impact: "DOWN", status: "IN_PROGRESS", severity: "SEV1",
    awareAt: new Date("2026-10-05T08:43:00Z"), resolvedAt: null,
  },
  entity: { legalName: "Revolut Ltd", country: "GB" },
  contact: { name: "Priya Nair", email: "priya.nair@revolut.example", timeZone: "Europe/London" },
  communicatorName: "Adrian Koh",
  ownerName: "Lukas Brenner",
  isPartnerIssue: false,
  resolution: null,
  report: null,
  preparedAt: PREPARED,
  ...over,
});
const RESOLVED = { resolvedAt: new Date("2026-10-05T09:20:00Z") };
const RESOLUTION = { rootCause: "Lloyds CoP gateway overloaded after a configuration change.", solution: "Lloyds rolled back the change." };

describe("the four templates", () => {
  it("1. first notification: today's text, with the customer-facing status", () => {
    const m = buildStageMessage("FIRST_NOTIFICATION", input());
    expect(m.subject).toBe("[Corvane] Sev-1 incident ISS-1046: UK CoP GB");
    expect(m.body).toContain("We are informing you of an incident affecting Revolut Ltd.");
    expect(m.body).toContain("Affected service: UK CoP, GB");
    expect(m.body).toContain("Current status: Investigating");
    expect(m.body).not.toContain("In progress");
    expect(m.to).toBe("priya.nair@revolut.example");
  });

  it("2. update: 'Dear <contact>', status, the line to complete, the next update in the contact's zone, signed by the communicator", () => {
    const m = buildStageMessage("UPDATE", input());
    expect(m.subject).toBe("[Corvane] Update: Sev-1 incident ISS-1046: UK CoP GB");
    expect(m.body).toContain("Dear Priya Nair,\n\nThis is an update on incident ISS-1046 affecting Revolut Ltd.\n\nCurrent status: Investigating\nWhat we are doing: [one line to complete before sending]\nNext update by: Mon 05 Oct, ");
    expect(m.body).toMatch(/Next update by: Mon 05 Oct, \d\d:\d\d BST\n\nPlease quote ISS-1046 in any reply\.\n\nKind regards,\nAdrian Koh\nCorvane$/);
  });

  it("3. resolution: the cause and solution from the Resolve dialog, the resolved time in the contact's zone, the report sentence only when a task exists", () => {
    const issue = { ...input().issue, status: "RESOLVED" as const, ...RESOLVED };
    const without = buildStageMessage("RESOLUTION", input({ issue, resolution: RESOLUTION }));
    expect(without.subject).toBe("[Corvane] Resolved: Sev-1 incident ISS-1046: UK CoP GB");
    expect(without.body).toContain("The incident affecting Revolut Ltd has been resolved.");
    expect(without.body).toContain("Corvane aware at: Mon 05 Oct, 09:43 BST");
    expect(without.body).toContain("Resolved at: Mon 05 Oct, 10:20 BST");
    expect(without.body).toContain("Cause: Lloyds CoP gateway overloaded after a configuration change.");
    expect(without.body).toContain("Solution: Lloyds rolled back the change.");
    expect(without.body).toContain("Please reply to confirm that the service works as expected on your side.");
    expect(without.body).not.toContain("root cause report");

    const dueAt = new Date("2026-10-19T09:20:00Z");
    const withTask = buildStageMessage("RESOLUTION", input({ issue, resolution: RESOLUTION, report: { dueAt, draftSummary: null, draftLink: null } }));
    expect(withTask.body).toContain("A root cause report will follow by Mon 19 Oct, as agreed in our contract.");
    expect(buildStageMessage("RESOLUTION", input({ issue, resolution: RESOLUTION, report: { dueAt: null, draftSummary: null, draftLink: null } })).body).toContain("A root cause report will follow, as agreed in our contract.");
  });

  it("4. root cause report: the approved draft's summary and link, the date the incident affected the customer, signed by the owner", () => {
    const issue = { ...input().issue, status: "RESOLVED" as const, ...RESOLVED };
    const m = buildStageMessage("REPORT", input({ issue, report: { dueAt: null, draftSummary: "Cause, impact and corrective actions.", draftLink: "https://docs.corvane-internal.example/reports/r1.pdf" } }));
    expect(m.subject).toBe("[Corvane] Root cause report: incident ISS-1046");
    expect(m.body).toBe(
      [
        "Dear Priya Nair,", "",
        "Please find the root cause report for incident ISS-1046, which affected Revolut Ltd on Mon 05 Oct.", "",
        "Cause, impact and corrective actions.", "",
        "Report: https://docs.corvane-internal.example/reports/r1.pdf", "",
        "Please quote ISS-1046 in any reply.", "", "Kind regards,", "Lukas Brenner", "Corvane",
      ].join("\n"),
    );
  });

  it("times are in the contact's zone with its label, and in a different zone when the contact is elsewhere", () => {
    const issue = { ...input().issue, status: "RESOLVED" as const, ...RESOLVED };
    const sg = buildStageMessage("RESOLUTION", input({ issue, resolution: RESOLUTION, contact: { name: "Wei Tan", email: "wei@example", timeZone: "Asia/Singapore" } }));
    expect(sg.body).toContain("Corvane aware at: Mon 05 Oct, 16:43 SGT");
    expect(sg.body).toContain("Resolved at: Mon 05 Oct, 17:20 SGT");
  });

  it("partner wording: first notification 'We are seeing …', resolution 'Thank you for restoring …'", () => {
    const partner = input({ isPartnerIssue: true, entity: { legalName: "Lloyds Bank plc", country: "GB" }, contact: { name: "Paul Grant", email: "paul.grant@lloyds.example", timeZone: "Europe/London" }, communicatorName: "Lukas Brenner" });
    const first = buildStageMessage("FIRST_NOTIFICATION", partner);
    expect(first.body).toContain("Dear Paul Grant,");
    expect(first.body).toContain("We are seeing an outage on your UK CoP service (GB) since Mon 05 Oct, 09:43 BST.");
    expect(first.body).not.toContain("We are informing you of an incident affecting");
    const issue = { ...partner.issue, status: "RESOLVED" as const, ...RESOLVED };
    const resolved = buildStageMessage("RESOLUTION", { ...partner, issue, resolution: RESOLUTION, report: { dueAt: new Date("2026-10-19T09:20:00Z"), draftSummary: null, draftLink: null } });
    expect(resolved.body).toContain("Thank you for restoring UK CoP (GB).");
    expect(resolved.body).not.toContain("root cause report"); // no report on a partner issue, even if a task were present
    expect(buildStageMessage("UPDATE", partner).body).toContain("This is an update on incident ISS-1046 on your UK CoP service (GB).");
  });

  it("no contact: the greeting names the team and the times use the fallback zone", () => {
    const m = buildStageMessage("UPDATE", input({ contact: null }));
    expect(m.body.startsWith("Dear Revolut Ltd team,")).toBe(true);
    expect(m.to).toBeNull();
  });
});

describe("customer-facing status", () => {
  it("never the internal status name: New, Acknowledged and Investigating read 'Investigating'; Mitigated and Monitoring 'Fix applied, monitoring'; anything else 'Investigating'", () => {
    for (const s of ["NEW", "ACKNOWLEDGED", "INVESTIGATING", "IN_PROGRESS", "WAITING_ON_CUSTOMER", "WAITING_ON_PARTNER", "SOMETHING_ELSE", ""]) expect(customerFacingStatus(s), s).toBe("Investigating");
    for (const s of ["MITIGATED", "MONITORING"]) expect(customerFacingStatus(s), s).toBe("Fix applied, monitoring");
  });

  it("the Update and the partner messages use it; the internal names ('In progress', 'Waiting on customer', 'New') never appear in them", () => {
    for (const status of ["NEW", "IN_PROGRESS", "WAITING_ON_CUSTOMER", "WAITING_ON_PARTNER"] as const) {
      const customer = buildStageMessage("UPDATE", input({ issue: { ...input().issue, status } }));
      expect(customer.body, status).toContain("Current status: Investigating");
      expect(customer.body, status).not.toMatch(/Current status: (New|In progress|Waiting)/);
      const first = buildStageMessage("FIRST_NOTIFICATION", input({ issue: { ...input().issue, status } })); // the customer's first notification too
      expect(first.body, status).toContain("Current status: Investigating");
      expect(first.body, status).not.toMatch(/Current status: (New|In progress|Waiting)/);
      const partner = input({ isPartnerIssue: true, issue: { ...input().issue, status } });
      for (const stage of ["FIRST_NOTIFICATION", "UPDATE"] as const) {
        expect(buildStageMessage(stage, partner).body, `${status} ${stage}`).toContain("Current status: Investigating");
      }
    }
  });

  it("on a linked customer issue the Resolution and Root cause report messages quote the customer issue's own ID, never the partner issue's", () => {
    // ISS-1046 is the linked customer issue of the partner issue ISS-1045: the message is built from the customer issue's own number.
    const issue = { ...input().issue, number: 1046, status: "RESOLVED" as const, ...RESOLVED };
    for (const [stage, extra] of [["RESOLUTION", { resolution: RESOLUTION }], ["REPORT", { report: { dueAt: null, draftSummary: "Summary.", draftLink: "https://docs.corvane-internal.example/r.pdf" } }]] as const) {
      const m = buildStageMessage(stage, input({ issue, ...extra }));
      expect(m.subject, stage).toContain("ISS-1046");
      expect(m.subject, stage).not.toContain("ISS-1045");
      expect(m.body, stage).toContain("ISS-1046");
      expect(m.body, stage).not.toContain("ISS-1045");
    }
  });
});

describe("the root cause report summary", () => {
  it("puts Cause, Impact and Fix on separate lines, like the Resolution template", () => {
    const issue = { ...input().issue, status: "RESOLVED" as const, ...RESOLVED };
    const m = buildStageMessage("REPORT", input({ issue, report: { dueAt: null, draftSummary: "Cause: partner gateway overload. Impact: UK CoP checks timed out. Fix: configuration rollback and a latency alert.", draftLink: null } }));
    expect(m.body).toContain("Cause: partner gateway overload.\nImpact: UK CoP checks timed out.\nFix: configuration rollback and a latency alert.");
  });
});
