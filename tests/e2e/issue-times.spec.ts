import "dotenv/config";

import { expect, test, type Page } from "@playwright/test";

import { db } from "@/server/db";

import { EMAIL, resetDemoData, signInAs } from "./fixtures/role-actions-setup";

/**
 * Event, awareness and opened times. Runs only under the `role-actions` Playwright project: a
 * production build, demo clock Mon 05 Oct 2026, 10:48 CEST (playwright.config.ts). Kevin Lim (Ops, MYT) owns ISS-1038 on Revolut Ltd;
 * Emma Wilson (Customer Success, CEST) reports; Lukas Brenner (Network, SGT) owns the partner outage on Lloyds Bank plc.
 */

test.describe.configure({ mode: "serial" });

const EMMA = "emma.wilson@corvane.example";

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext({ baseURL: "http://localhost:3104" });
  await resetDemoData(context.request);
  await context.close();
});

test.beforeEach(async ({ context }) => {
  await context.route("https://mail.google.com/**", (r) => r.fulfill({ body: "ok" }));
});

/** "HH:MM" minus some minutes, same day (the demo clock sits at 10:48, so no midnight to cross). */
function minus(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const t = h * 60 + m - minutes;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

async function openReportDrawer(page: Page, entityName: string) {
  const entity = await db.entity.findFirstOrThrow({ where: { legalName: entityName } });
  await page.goto(`/entities/${entity.id}/overview`);
  await page.getByRole("button", { name: "Report issue" }).click();
  return page.getByRole("dialog", { name: "Report issue" });
}

async function fillWrongMatch(page: Page, drawer: ReturnType<Page["getByRole"]>) {
  await drawer.getByRole("combobox", { name: "Type" }).click();
  await page.getByRole("option", { name: "Wrong match result" }).click();
  await drawer.getByRole("combobox", { name: "Product line" }).click();
  await page.getByRole("option", { name: /UK CoP \/ GB/ }).click();
  await drawer.getByLabel("Description").fill("Trade-name payees return No match since this morning.");
  await drawer.getByRole("combobox", { name: "Reported at the customer by" }).click();
  await page.getByRole("option", { name: "Found by Corvane" }).click();
  await drawer.getByRole("radio", { name: "Degraded" }).check();
  await drawer.getByRole("radio", { name: "No" }).check();
}

test.describe("Report issue: the three times", () => {
  test("the drawer asks for Corvane aware at, Source and Event with Unknown; the order is checked and every value is kept", async ({ page }) => {
    await signInAs(page, EMMA);
    const drawer = await openReportDrawer(page, "Revolut Ltd");

    await expect(drawer.getByText("Corvane aware at *")).toBeVisible();
    await expect(drawer.getByText("When the signal reached Corvane, for example when the email arrived, not when it was read. Deadlines count from this time.")).toBeVisible();
    await expect(drawer.getByTestId("report-times-source")).toContainText("Email");
    await expect(drawer.getByText("Event date and time")).toBeVisible();
    await expect(drawer.getByText("When the problem started, if known.")).toBeVisible();
    await fillWrongMatch(page, drawer);
    const submit = drawer.getByRole("button", { name: "Report issue" });
    await expect(submit).toBeEnabled();

    // Event starts empty and is optional: nothing is recorded that nobody stated. Left empty, the report can be sent.
    const awareDate = await drawer.getByTestId("report-times-aware-date").inputValue();
    const awareTime = await drawer.getByTestId("report-times-aware-time").inputValue();
    await expect(drawer.getByTestId("report-times-event-date")).toHaveValue("");
    await expect(drawer.getByTestId("report-times-event-time")).toHaveValue("");
    await expect(submit).toBeEnabled();

    // Half an Event is refused; a real Event on or before Corvane aware at is accepted.
    await drawer.getByTestId("report-times-event-date").fill(awareDate);
    await expect(drawer.getByText("Enter both the event date and the event time, or leave them empty")).toBeVisible();
    await submit.click(); // Report issue stays enabled: with fields missing it shows the errors and sends nothing
    await expect(drawer).toBeVisible();
    await expect(page).not.toHaveURL(/\/issues\//);
    await drawer.getByTestId("report-times-event-time").fill(minus(awareTime, 10));
    await expect(submit).toBeEnabled();

    // Event after Corvane aware at: one message, on the Event field; nothing is cleared.
    // The future is refused too.
    await drawer.getByTestId("report-times-aware-time").fill("23:59");
    await expect(drawer.getByText("Corvane aware at can't be in the future")).toBeVisible();

    // Unknown disables and clears the event inputs, and the error goes with them.
    await drawer.getByTestId("report-times-aware-time").fill(minus(awareTime, 60));
    await drawer.getByTestId("report-times-event-unknown").check();
    await expect(drawer.getByTestId("report-times-event-date")).toBeDisabled();
    await expect(drawer.getByTestId("report-times-event-time")).toHaveValue("");
    await expect(drawer.getByText("Event can't be after Corvane aware at")).toHaveCount(0);
    await expect(submit).toBeEnabled();
  });

  test("reported as Emma Wilson with Event, Source Phone and an issue opened an hour after Corvane aware at: the Timeline shows all three and the amber marker", async ({ page }) => {
    await signInAs(page, EMMA);
    const drawer = await openReportDrawer(page, "Revolut Ltd");
    await fillWrongMatch(page, drawer);

    const awareTime = await drawer.getByTestId("report-times-aware-time").inputValue();
    await drawer.getByTestId("report-times-aware-time").fill(minus(awareTime, 60));
    await drawer.getByTestId("report-times-event-date").fill(await drawer.getByTestId("report-times-aware-date").inputValue());
    await drawer.getByTestId("report-times-event-time").fill(minus(awareTime, 80));
    await drawer.getByTestId("report-times-source").click();
    await page.getByRole("option", { name: "Phone" }).click();
    await drawer.getByRole("button", { name: "Report issue" }).click();

    await expect(page).toHaveURL(/\/issues\/.+\?reported=1/);
    const issue = await db.issue.findUniqueOrThrow({ where: { id: page.url().match(/\/issues\/([^/?]+)/)![1] } });
    expect(issue.awarenessSource).toBe("PHONE");
    expect(issue.eventAt).not.toBeNull();
    expect((issue.awareAt.getTime() - issue.eventAt!.getTime()) / 60_000).toBe(20);
    const gap = Math.round((issue.createdAt.getTime() - issue.awareAt.getTime()) / 60_000);
    expect(gap).toBeGreaterThanOrEqual(60); // Opened is written from the demo clock, an hour or a little more after

    const timeline = page.getByRole("region", { name: "Timeline" });
    await expect(timeline.getByTestId("timeline-event")).toContainText("When the problem started");
    await expect(timeline.getByTestId("timeline-aware")).toContainText("Source: Phone");
    const opened = timeline.getByTestId("timeline-opened");
    await expect(opened.getByTestId("timeline-opened-gap")).toContainText(/after Corvane aware at/);
    await expect(opened.getByTestId("timeline-opened-gap")).toContainText(`more than 30 min on a Sev-${issue.severity === "SEV1" ? 1 : 2} issue`);
  });

  test("Event left empty is saved as Unknown: the Timeline says Unknown and 'No event time set', and an issue opened within 30 min shows no interval line", async ({ page }) => {
    await signInAs(page, EMMA);
    const drawer = await openReportDrawer(page, "Revolut Ltd");
    await fillWrongMatch(page, drawer);
    await drawer.getByRole("button", { name: "Report issue" }).click();

    await expect(page).toHaveURL(/\/issues\/.+\?reported=1/);
    const issue = await db.issue.findUniqueOrThrow({ where: { id: page.url().match(/\/issues\/([^/?]+)/)![1] } });
    expect(issue.eventAt).toBeNull();
    const timeline = page.getByRole("region", { name: "Timeline" });
    await expect(timeline.getByTestId("timeline-event")).toContainText("Unknown");
    await expect(timeline.getByTestId("timeline-event")).toContainText("No event time set");
    await expect(timeline.getByTestId("timeline-aware")).toContainText("Source: Email");
    await expect(timeline.getByTestId("timeline-opened-gap")).toHaveCount(0);
  });
});

test.describe("Correct times, as Kevin Lim on ISS-1038", () => {
  test("seeded ISS-1038 shows the marker; only the owner has the link; the dialog checks the order and the reason", async ({ page }) => {
    const iss = await db.issue.findFirstOrThrow({ where: { number: 1038 } });
    await signInAs(page, EMAIL.adrian);
    await page.goto(`/issues/${iss.id}`);
    await expect(page.getByTestId("correct-times-link")).toHaveCount(0); // Adrian is the communicator, not the owner
    await expect(page.getByTestId("timeline-opened-gap")).toContainText("35 min after Corvane aware at");
    await expect(page.getByTestId("timeline-opened-gap")).toContainText("more than 30 min on a Sev-2 issue");
    await expect(page.getByTestId("timeline-aware")).toContainText("Source: Email");

    await signInAs(page, EMAIL.kevin);
    await page.goto(`/issues/${iss.id}`);
    await page.getByTestId("correct-times-link").click();
    const dialog = page.getByRole("dialog", { name: "Correct times" });
    await expect(dialog).toContainText("ISS-1038 · Wrong match result · Revolut Ltd");
    await expect(dialog.getByText("Deadlines will be recalculated from the corrected Corvane aware at time.")).toBeVisible();
    const save = dialog.getByRole("button", { name: "Save correction" });
    await expect(save).toBeDisabled(); // nothing changed, no reason

    const awareTime = await dialog.getByTestId("correct-times-aware-time").inputValue();
    await dialog.getByTestId("correct-times-event-time").fill(minus(awareTime, -5)); // 5 min after Corvane aware at
    await expect(dialog.getByText("Event can't be after Corvane aware at")).toBeVisible();
    await dialog.getByLabel("Reason *").fill("Typo");
    await expect(dialog.getByText("Enter 10 to 500 characters")).toBeVisible();
    await expect(save).toBeDisabled();
  });

  test("a correction: Timeline row with the original values on hover and focus, History in the reader's zone, met deadlines stay met", async ({ page }) => {
    const iss = await db.issue.findFirstOrThrow({ where: { number: 1038 }, include: { entity: true } });
    await signInAs(page, EMAIL.kevin);
    await page.goto(`/issues/${iss.id}`);
    await page.getByTestId("correct-times-link").click();
    const dialog = page.getByRole("dialog", { name: "Correct times" });

    const awareTime = await dialog.getByTestId("correct-times-aware-time").inputValue();
    const eventTime = await dialog.getByTestId("correct-times-event-time").inputValue();
    await dialog.getByTestId("correct-times-aware-time").fill(minus(awareTime, 10));
    await dialog.getByTestId("correct-times-event-time").fill(minus(eventTime, 10));
    await dialog.getByTestId("correct-times-source").click();
    await page.getByRole("option", { name: "Phone" }).click();
    await dialog.getByLabel("Reason *").fill("The customer phoned before the email arrived.");
    await dialog.getByRole("button", { name: "Save correction" }).click();
    await expect(page.getByText("Times corrected")).toBeVisible();

    const after = await db.issue.findUniqueOrThrow({ where: { id: iss.id } });
    expect(after.awarenessSource).toBe("PHONE");
    expect((iss.awareAt.getTime() - after.awareAt.getTime()) / 60_000).toBe(10);
    expect(after.ackStartAt).toEqual(iss.ackStartAt); // acknowledged already: that deadline stays met, with its recorded result
    expect(after.notifyStartAt).toEqual(iss.notifyStartAt);
    expect(await db.issueTimeCorrection.count({ where: { issueId: iss.id } })).toBe(3);

    const row = page.getByTestId("timeline-correction");
    const target = row.getByText(/^Corrected by Kevin Lim, \w{3} \d\d \w{3}, \d\d:\d\d MYT$/);
    await expect(target).toBeVisible();
    await target.hover();
    const tip = page.getByRole("tooltip");
    await expect(tip).toBeVisible();
    await expect(tip).toContainText("Original values");
    await expect(tip).toContainText(/Corvane aware at \w{3} \d\d \w{3}, \d\d:\d\d MYT/);
    await expect(tip).toContainText(/Event \w{3} \d\d \w{3}, \d\d:\d\d MYT/);
    await expect(tip).toContainText("Source Email");
    await page.mouse.move(0, 0);
    await expect(tip).toBeHidden();
    await target.focus();
    await expect(tip).toBeVisible();

    // History: the event is stored in UTC and shown in Kevin's zone.
    await page.goto(`/entities/${iss.entityId}/history`);
    await expect(page.getByText(/^Corvane aware at corrected from .+ MYT to .+ MYT by Kevin Lim: The customer phoned before the email arrived\.$/)).toBeVisible();
    const event = await db.historyEvent.findFirstOrThrow({ where: { issueId: iss.id, summary: { startsWith: "Corvane aware at corrected" } } });
    expect(event.summary).toContain(" UTC to ");
  });
});

test.describe("Resolve with Event, as Lukas Brenner", () => {
  test("a Sev-1 partner issue with Event unknown needs Event; the one entered applies to every linked issue", async ({ page }) => {
    test.setTimeout(240_000);
    await signInAs(page, EMAIL.lukas);
    const drawer = await openReportDrawer(page, "Lloyds Bank plc");
    await drawer.getByRole("combobox", { name: "Type" }).click();
    await page.getByRole("option", { name: "Partner degraded or unavailable" }).click();
    await drawer.getByRole("radio", { name: /UK CoP \/ GB/ }).check(); // Lloyds has three coverages: pick the one, no scheme or country to type
    await drawer.getByLabel("Description").fill("Lloyds Bank plc CoP responses time out. Revolut Ltd payee checks on UK CoP GB return no result.");
    await drawer.getByRole("combobox", { name: "Reported at the customer by" }).click();
    await page.getByRole("option", { name: "Found by Corvane" }).click();
    await drawer.getByRole("radio", { name: "Down" }).check();
    await drawer.getByRole("radio", { name: "No" }).check();
    await drawer.getByRole("button", { name: "Report issue" }).click(); // Event left empty = Unknown

    await expect(page).toHaveURL(/\/issues\/.+\?reported=1/);
    const parentId = page.url().match(/\/issues\/([^/?]+)/)![1];
    const parent = await db.issue.findUniqueOrThrow({ where: { id: parentId } });
    expect(parent.severity).toBe("SEV1");
    expect(parent.eventAt).toBeNull();

    await page.getByRole("button", { name: "Create linked issues" }).click();
    await page.getByRole("dialog", { name: "Create linked issues" }).getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.getByText("Linked issues created")).toBeVisible();

    // The Linked issues panel reads the server demo clock like every other time: Notify in ..., never "Overdue by N days" from the machine clock
    // (the demo clock is days behind the real one), consistent with the Notify by times of the Affected customers table above it.
    await expect(page.getByText(/^Linked issues \(\d+\)/)).toContainText("Linked issues (3)");
    const panel = page.getByText(/^Linked issues \(\d+\)/).locator("..");
    await expect(panel).not.toContainText("Overdue");
    expect((await panel.innerText()).match(/Notify customer in (\d+ min|\d+ h( \d+ min)?)/g)).toHaveLength(3);
    await expect(page.getByRole("columnheader", { name: "Notify by" })).toBeVisible();
    await expect(page.getByRole("cell", { name: /^\w{3} \d\d \w{3}, \d\d:\d\d SGT/ }).first()).toBeVisible(); // the table's Notify by, in Lukas's zone
    // A partner issue has nothing to show in Compliance (no flag, no assessment): no empty card. The flagged Revolut linked issue keeps it.
    await expect(page.getByRole("region", { name: "Compliance" })).toHaveCount(0);
    const links0 = await db.issueLink.findFirstOrThrow({ where: { parentId: page.url().match(/\/issues\/([^/?]+)/)![1], kind: "CREATED", child: { entity: { legalName: "Revolut Ltd" } } } });
    const parentUrl = page.url();
    await page.goto(`/issues/${links0.childId}`);
    await expect(page.getByRole("region", { name: "Compliance" })).toBeVisible();
    await page.goto(parentUrl);
    const links = await db.issueLink.findMany({ where: { parentId, kind: "CREATED" }, include: { child: true } });
    expect(links.length).toBeGreaterThan(0);
    for (const l of links) {
      expect(l.child.eventAt).toBeNull();
      expect(l.child.awareAt).toEqual(parent.awareAt);
      expect(l.child.awarenessSource).toBe(parent.awarenessSource);
    }

    await page.goto(`/issues/${parentId}`);
    await page.getByRole("button", { name: "Acknowledge" }).click();
    await expect(page.getByText("Issue acknowledged")).toBeVisible();
    await page.goto(`/issues/${parentId}`);
    await page.getByRole("group", { name: "Issue actions" }).getByRole("button", { name: "Change status", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Change status" });
    await dialog.getByRole("radio", { name: "Resolved" }).check();
    await dialog.getByLabel("Root cause").fill("Lloyds CoP gateway overloaded after a configuration change on their side.");
    await dialog.getByLabel("Solution").fill("Lloyds rolled back the change; response times are back under one second.");
    const resolve = dialog.getByRole("button", { name: "Resolve issue" });
    await expect(dialog.getByText("Event date and time *")).toBeVisible();
    await expect(dialog.getByText("Needed for the root cause report. When the problem started at the customer or partner.")).toBeVisible();
    await expect(resolve).toBeDisabled();

    // After Corvane aware at: refused, with the time it is compared to.
    const awareTime = await page.getByTestId("timeline-aware").innerText();
    expect(awareTime).toMatch(/\d\d:\d\d SGT/);
    await dialog.getByTestId("resolve-event-date").fill("2026-10-05");
    await dialog.getByTestId("resolve-event-time").fill("23:00");
    await expect(dialog.getByText(/^Event can't be after Corvane aware at \(\w{3} \d\d \w{3}, \d\d:\d\d SGT\)$/)).toBeVisible();
    await expect(resolve).toBeDisabled();

    await dialog.getByTestId("resolve-event-time").fill("09:00");
    await expect(resolve).toBeEnabled();
    await resolve.click();
    await page.getByRole("dialog", { name: "Resolve with linked issues" }).getByRole("button", { name: "Resolve" }).click();
    await expect(page.getByText("Issue resolved")).toBeVisible();

    const resolved = await db.issue.findUniqueOrThrow({ where: { id: parentId } });
    expect(resolved.eventAt).not.toBeNull();
    for (const l of links) {
      const child = await db.issue.findUniqueOrThrow({ where: { id: l.childId } });
      expect(child.eventAt).toEqual(resolved.eventAt);
      expect(child.status).toBe("RESOLVED");
    }

    // A linked issue: "Times from ISS-n", never Correct times.
    await page.goto(`/issues/${links[0].childId}`);
    const timeline = page.getByRole("region", { name: "Timeline" });
    await expect(timeline.getByText(/^Times from ISS-\d+$/)).toBeVisible();
    await expect(page.getByTestId("correct-times-link")).toHaveCount(0);
    await expect(timeline.getByTestId("timeline-event")).toContainText("When the problem started");
  });
});
