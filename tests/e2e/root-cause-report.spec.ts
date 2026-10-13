import "dotenv/config";

import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { db } from "@/server/db";
import { SESSION_COOKIE, signUserCookie } from "@/server/session";

import { createLinkedIssueFixture, EMAIL, resolvePartnerWithCascade, signInAs, type LinkedIssueFixture } from "./fixtures/role-actions-setup";

/**
 * Root cause report task (M27 AC1 to AC7, Release 1). Runs under the `role-actions` project: a production build,
 * demo clock Mon 05 Oct 2026, 10:48 CEST. Lukas Brenner (Network, SGT) reports the Lloyds partner issue, creates
 * the linked issues (Revolut, Santander UK, Lloyds as a customer), and resolves it with the cascade.
 */

test.describe.configure({ mode: "serial" });

const DAY = 24 * 3_600_000;
let fx: LinkedIssueFixture;
const children: Record<string, { id: string; displayId: string }> = {};

async function childOf(entityName: string) {
  const link = await db.issueLink.findFirstOrThrow({ where: { parentId: fx.parentId, kind: "CREATED", unlinkedAt: null, child: { entity: { legalName: entityName } } }, include: { child: true } });
  return { id: link.childId, displayId: `ISS-${String(link.child.number).padStart(4, "0")}` };
}

test.beforeAll(async ({ browser }) => {
  test.setTimeout(300_000);
  const context = await browser.newContext({ baseURL: "http://localhost:3104" });
  const page = await context.newPage();
  fx = await createLinkedIssueFixture(page, context.request);
  for (const name of ["Revolut Ltd", "Santander UK plc", "Lloyds Bank plc"]) children[name] = await childOf(name);

  await resolvePartnerWithCascade(page, fx);
  await context.close();
});

test.beforeEach(async ({ context }) => {
  await context.route("https://mail.google.com/**", (r) => r.fulfill({ body: "ok" }));
});

async function openMine(page: Page, email: string) {
  await signInAs(page, email);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /^Issues/ })).toBeVisible();
}

test("the cascade creates three tasks (Revolut +14 days, Santander UK +30, Lloyds +14), none on the partner issue, and adds Mei Chen as contributor", async () => {
  const expected = { "Revolut Ltd": 14, "Santander UK plc": 30, "Lloyds Bank plc": 14 } as const;
  const mei = await db.user.findUniqueOrThrow({ where: { email: EMAIL.mei } });
  for (const [name, days] of Object.entries(expected)) {
    const child = await db.issue.findUniqueOrThrow({ where: { id: children[name].id } });
    expect(child.status, name).toBe("RESOLVED");
    const task = await db.rootCauseReportTask.findUniqueOrThrow({ where: { issueId: child.id } });
    expect(task.reportDays, name).toBe(days);
    expect(task.dueAt!.getTime(), name).toBe(child.resolvedAt!.getTime() + days * DAY);
    const contributor = await db.issueContributor.findFirstOrThrow({ where: { issueId: child.id, userId: mei.id, removedAt: null } });
    expect(contributor.addedForReport, name).toBe(true);
    const history = await db.historyEvent.findFirstOrThrow({ where: { issueId: child.id, summary: { startsWith: "Root cause report task created, due" } } });
    expect(history.category).toBe("INCIDENT");
  }
  expect(await db.rootCauseReportTask.count({ where: { issueId: fx.parentId } })).toBe(0);
});

const DRAFT = { draftLink: "https://docs.corvane-internal.example/reports/revolut-cop-gb-draft.pdf", draftSummary: "Cause: partner gateway overload. Impact: UK CoP checks timed out. Fix: configuration rollback." };

function cookieOf(userId: string) {
  return `${SESSION_COOKIE}=${signUserCookie(userId)}`;
}

/** The owner shares a draft through the real endpoint (Lukas owns every issue the cascade resolved). */
async function shareDraftViaApi(request: APIRequestContext, issueId: string, over: Partial<typeof DRAFT> = {}) {
  const owner = await db.user.findUniqueOrThrow({ where: { email: EMAIL.lukas } });
  const issue = await db.issue.findUniqueOrThrow({ where: { id: issueId } });
  return request.post(`/api/issues/${issueId}/root-cause-report/draft`, { headers: { cookie: cookieOf(owner.id) }, data: { ...DRAFT, ...over, version: issue.version } });
}

/** Compliance approves a report through the real endpoint, as the person given (Mei Chen unless another cookie is passed). */
async function approveViaApi(request: APIRequestContext, issueId: string, email = EMAIL.mei) {
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  return request.post(`/api/issues/${issueId}/root-cause-report/approve`, { headers: { cookie: cookieOf(user.id) }, data: {} });
}

/** Draft shared and approved, both through the real endpoints. */
async function draftAndApprove(request: APIRequestContext, issueId: string) {
  expect((await shareDraftViaApi(request, issueId)).status()).toBe(200);
  expect((await approveViaApi(request, issueId)).status()).toBe(200);
}

test("right after the resolution, Lukas's Home has 'Prepare root cause report for <customer>' (by the contract date) and Mei waits on him: 'Waiting on Lukas Brenner (Owner): Share the draft'", async ({ page }) => {
  // Mei has assessed all three and Adrian has told every customer, so the report is the one step still open (until she assesses, her row says
  // "Assess"; until he notifies, "Notify" leads).
  const mei = await db.user.findUniqueOrThrow({ where: { email: EMAIL.mei } });
  for (const name of ["Revolut Ltd", "Santander UK plc", "Lloyds Bank plc"]) {
    await db.complianceAssessment.create({ data: { issueId: children[name].id, outcome: "NEITHER", rationale: "Assessed for the test: no major incident.", assessedById: mei.id, assessedAt: new Date() } });
    await db.issue.update({ where: { id: children[name].id }, data: { notifiedAt: new Date() } });
  }
  await openMine(page, EMAIL.lukas);
  for (const name of ["Revolut Ltd", "Lloyds Bank plc", "Santander UK plc"] as const) { // 14, 14 days, then 30
    const row = page.getByTestId(`issue-row-${children[name].id}`);
    await expect(row.getByTestId(`line1-${children[name].id}`)).toHaveText(`Prepare root cause report for ${name}`);
    const tb = row.getByTestId(`time-block-${children[name].id}`);
    await expect(tb.locator("span").first()).toHaveText(/^(13|14|29|30) days?$/);
    await expect(tb).toContainText(/by \w{3} \d\d \w{3}$/); // "by Mon 19 Oct": a date, no zone label
    await expect(tb).not.toContainText("SGT");
    await expect(row).toContainText("Resolved");
  }
  await openMine(page, EMAIL.mei);
  for (const name of ["Revolut Ltd", "Santander UK plc", "Lloyds Bank plc"]) {
    await expect(page.getByTestId(`line1-${children[name].id}`)).toHaveText("Waiting on Lukas Brenner (Owner): Share the draft");
  }
});

test("the Revolut issue as Lukas before the draft: Prepare is his open step with 'Share draft'; Approve and Send wait, with their deadline and what they wait for", async ({ page }) => {
  await signInAs(page, EMAIL.lukas);
  await page.goto(`/issues/${children["Revolut Ltd"].id}`);
  const wdw = page.getByRole("region", { name: "Action plan" });
  const prepare = wdw.getByTestId("plan-row-prepare_report");
  await expect(prepare).toHaveAttribute("data-state", "open");
  await expect(prepare).toHaveAttribute("data-me", "true");
  await expect(prepare).toContainText("Prepare root cause report for Revolut Ltd");
  await expect(prepare).toContainText("Required by the customer contract: 14 days after resolution");
  await expect(prepare.getByTestId("plan-time-prepare_report")).toContainText(/by \w{3} \d\d \w{3}$/);
  await expect(page.getByRole("region", { name: "Your next action" }).getByRole("button", { name: "Share draft" })).toBeVisible();

  const review = wdw.getByTestId("plan-row-review_report");
  await expect(review).toHaveAttribute("data-state", "blocked");
  await expect(review).toContainText("Approve root cause report");
  await expect(review).toContainText("Starts when Lukas Brenner shares the draft");
  await expect(review.getByTestId("plan-time-review_report")).toContainText(/by \w{3} \d\d \w{3}$/);
  const send = wdw.getByTestId("plan-row-send_report");
  await expect(send).toHaveAttribute("data-state", "blocked");
  await expect(send).toContainText("Send approved report to Revolut Ltd");
  await expect(send).toContainText("Starts when Mei Chen approves");
  await expect(send.getByRole("button")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Record report sent" })).toHaveCount(0);
  // Confirm resolution with the customer stays open: it waits for neither the report nor the approval.
  await expect(wdw.getByTestId("plan-row-close")).toHaveAttribute("data-state", "open");
  // The process order: Confirm resolution, then Prepare, Approve and Send (the report chain is never split).
  const order = await wdw.locator('[data-testid^="plan-row-"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")));
  expect(order).toEqual(["plan-row-close", "plan-row-prepare_report", "plan-row-review_report", "plan-row-send_report"]);
});

test("step 1: the owner shares the draft (link on docs.corvane-internal.example, summary), the others cannot; Done line, History, and Mei's Home 'Approve root cause report'", async ({ page, request }) => {
  const id = children["Revolut Ltd"].id;
  const issue = await db.issue.findUniqueOrThrow({ where: { id } });
  // Only the owner: 403 for Compliance, the communicator and everyone else, and nothing is written.
  for (const email of [EMAIL.mei, EMAIL.adrian, EMAIL.kevin]) {
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    const res = await request.post(`/api/issues/${id}/root-cause-report/draft`, { headers: { cookie: cookieOf(user.id) }, data: { ...DRAFT, version: issue.version } });
    expect(res.status(), email).toBe(403);
  }
  expect((await db.rootCauseReportTask.findUniqueOrThrow({ where: { issueId: id } })).draftSharedAt).toBeNull();
  // The approval is not possible before a draft exists.
  expect((await approveViaApi(request, id)).status()).toBeGreaterThanOrEqual(400);

  await signInAs(page, EMAIL.lukas);
  await page.goto(`/issues/${id}`);
  await page.getByRole("region", { name: "Your next action" }).getByRole("button", { name: "Share draft" }).click();
  const dialog = page.getByRole("dialog", { name: "Share draft of the root cause report" });
  const share = dialog.getByRole("button", { name: "Share draft" });
  await expect(share).toBeDisabled();
  await dialog.getByLabel("Draft link *").fill("https://evil.example/draft.pdf");
  await expect(dialog.getByText("Enter a link starting with https://docs.corvane-internal.example/")).toBeVisible();
  await dialog.getByLabel("Summary *").fill("Short");
  await expect(dialog.getByText("Enter at least 10 characters")).toBeVisible();
  await expect(share).toBeDisabled();
  await dialog.getByLabel("Draft link *").fill(DRAFT.draftLink);
  await dialog.getByLabel("Summary *").fill(DRAFT.draftSummary);
  await expect(share).toBeEnabled();
  await share.click();
  await expect(page.getByText("Draft shared", { exact: true })).toBeVisible();

  const wdw = page.getByRole("region", { name: "Action plan" });
  await expect(wdw.getByTestId("plan-done")).toContainText(/Done: Draft shared by Lukas Brenner at \w{3} \d\d \w{3}, \d\d:\d\d SGT/);
  await expect(wdw.getByTestId("plan-row-prepare_report")).toHaveCount(0);
  await expect(wdw.getByTestId("plan-row-review_report")).toHaveAttribute("data-state", "open");
  await expect(wdw.getByTestId("plan-row-send_report")).toContainText("Starts when Mei Chen approves");

  await page.goto(`/entities/${issue.entityId}/history`);
  await expect(page.getByText("Root cause report draft shared by Lukas Brenner (Network)")).toBeVisible();

  // Home: Lukas waits on Compliance; Mei has "Approve root cause report" with the report's date.
  await page.goto("/");
  await expect(page.getByTestId(`line1-${id}`)).toHaveText("Waiting on Mei Chen (Compliance): Approve the report");
  await openMine(page, EMAIL.mei);
  const row = page.getByTestId(`issue-row-${id}`);
  await expect(row.getByTestId(`line1-${id}`)).toHaveText("Approve root cause report");
  await expect(row.getByTestId(`time-block-${id}`)).toContainText(/by \w{3} \d\d \w{3}$/);
});

test("step 2: Compliance requests changes (reason required) and the owner prepares a new draft; only Compliance can ask; the refused draft stays in History", async ({ page, request }) => {
  const id = children["Revolut Ltd"].id;
  const issue = await db.issue.findUniqueOrThrow({ where: { id } });
  for (const email of [EMAIL.lukas, EMAIL.adrian, EMAIL.kevin]) {
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    const res = await request.post(`/api/issues/${id}/root-cause-report/request-changes`, { headers: { cookie: cookieOf(user.id) }, data: { reason: "The impact section is missing the customer count." } });
    expect(res.status(), email).toBe(403);
  }
  expect((await db.rootCauseReportTask.findUniqueOrThrow({ where: { issueId: id } })).changesRequestedAt).toBeNull();

  await signInAs(page, EMAIL.mei);
  await page.goto(`/issues/${id}`);
  const next = page.getByRole("region", { name: "Your next action" });
  await expect(next.getByTestId("next-action-title")).toHaveText("Approve root cause report");
  await expect(next.getByRole("button", { name: "Approve report" })).toBeVisible();
  await next.getByRole("button", { name: "Request changes" }).click();
  const dialog = page.getByRole("dialog", { name: "Request changes to the root cause report" });
  const ask = dialog.getByRole("button", { name: "Request changes" });
  await expect(ask).toBeDisabled(); // a reason is required
  await dialog.getByLabel("Reason *").fill("Too short");
  await expect(dialog.getByText("Enter 10 to 2,000 characters")).toBeVisible();
  await dialog.getByLabel("Reason *").fill("The impact section is missing the customer count.");
  await ask.click();
  await expect(page.getByText("Changes requested", { exact: true })).toBeVisible();

  const task = await db.rootCauseReportTask.findUniqueOrThrow({ where: { issueId: id } });
  expect(task.draftSharedAt).toBeNull();
  expect(task.changesRequestReason).toBe("The impact section is missing the customer count.");
  const wdw = page.getByRole("region", { name: "Action plan" });
  await expect(wdw.getByTestId("plan-row-review_report")).toHaveAttribute("data-state", "blocked"); // Compliance waits again
  await expect(wdw.getByTestId("plan-row-review_report")).toContainText("Starts when Lukas Brenner shares the draft");
  await page.goto(`/entities/${issue.entityId}/history`);
  await expect(page.getByText("Changes requested by Mei Chen (Compliance): The impact section is missing the customer count.")).toBeVisible();

  // The owner's Prepare step is open again, with the reason on it.
  await signInAs(page, EMAIL.lukas);
  await page.goto(`/issues/${id}`);
  const prepare = page.getByRole("region", { name: "Action plan" }).getByTestId("plan-row-prepare_report");
  await expect(prepare).toHaveAttribute("data-state", "open");
  await expect(prepare).toContainText("Changes requested by Mei Chen: The impact section is missing the customer count.");
  // A new draft replaces the old one.
  expect((await shareDraftViaApi(request, id, { draftLink: "https://docs.corvane-internal.example/reports/revolut-cop-gb-draft-2.pdf", draftSummary: "Cause, impact (with the customer count) and corrective actions (draft 2)." })).status()).toBe(200);
  const second = await db.rootCauseReportTask.findUniqueOrThrow({ where: { issueId: id } });
  expect(second.draftLink).toBe("https://docs.corvane-internal.example/reports/revolut-cop-gb-draft-2.pdf");
  expect(second.changesRequestedAt).toBeNull();
  const drafts = await db.historyEvent.findMany({ where: { issueId: id, summary: { startsWith: "Root cause report draft shared" } } });
  expect(drafts).toHaveLength(2); // the first draft stays in History
});

test("step 2 again: Compliance approves (note optional); the Done line names who approved; History; Lukas's next step is 'Send approved report'; 403 for anyone else, and Record report sent is refused before the approval", async ({ page, request }) => {
  const id = children["Revolut Ltd"].id;
  for (const email of [EMAIL.lukas, EMAIL.adrian, EMAIL.kevin]) expect((await approveViaApi(request, id, email)).status(), email).toBe(403);
  expect((await db.rootCauseReportTask.findUniqueOrThrow({ where: { issueId: id } })).approvedAt).toBeNull();
  const issue = await db.issue.findUniqueOrThrow({ where: { id } });
  const contact = await db.contact.findFirstOrThrow({ where: { entityId: issue.entityId, context: "CUSTOMER", role: "INCIDENT", status: "ACTIVE" } });
  const lukas = await db.user.findUniqueOrThrow({ where: { email: EMAIL.lukas } });
  const early = await request.post(`/api/issues/${id}/root-cause-report`, {
    headers: { cookie: cookieOf(lukas.id) },
    data: { sentAt: new Date().toISOString(), contactId: contact.id, channel: "EMAIL", summary: "A report recorded before Compliance approved it.", version: issue.version },
  });
  expect(early.status()).toBeGreaterThanOrEqual(400);
  expect((await db.rootCauseReportTask.findUniqueOrThrow({ where: { issueId: id } })).sentAt).toBeNull();

  await signInAs(page, EMAIL.mei);
  await page.goto(`/issues/${id}`);
  const next = page.getByRole("region", { name: "Your next action" });
  const wdw = page.getByRole("region", { name: "Action plan" });
  await expect(wdw.getByTestId("plan-row-review_report").getByRole("button", { name: "Approve report" })).toBeVisible();
  await next.getByRole("button", { name: "Approve report" }).click();
  const dialog = page.getByRole("dialog", { name: "Approve root cause report" });
  await dialog.getByLabel("Note (optional)").fill("Reads well; the timeline matches the incident log.");
  await dialog.getByRole("button", { name: "Approve report" }).click();
  await expect(page.getByText("Report approved", { exact: true })).toBeVisible();

  await expect(wdw.getByTestId("plan-done")).toContainText(/Done: Root cause report approved by Mei Chen \(Compliance\) at \w{3} \d\d \w{3}, \d\d:\d\d SGT/);
  await expect(wdw.getByTestId("plan-row-review_report")).toHaveCount(0);
  const task = await db.rootCauseReportTask.findUniqueOrThrow({ where: { issueId: id } });
  expect(task.approvedById).toBe((await db.user.findUniqueOrThrow({ where: { email: EMAIL.mei } })).id);
  expect(task.approvalNote).toBe("Reads well; the timeline matches the incident log.");
  await page.goto(`/entities/${issue.entityId}/history`);
  await expect(page.getByText("Root cause report approved by Mei Chen (Compliance)")).toBeVisible();

  await signInAs(page, EMAIL.lukas);
  await page.goto("/");
  await expect(page.getByTestId(`line1-${id}`)).toHaveText("Send approved report to Revolut Ltd");
});

test("step 3 as Lukas after the approval: Your next action, Action plan, People, Customer obligations", async ({ page }) => {
  await signInAs(page, EMAIL.lukas);
  await page.goto(`/issues/${children["Revolut Ltd"].id}`);
  const wdw = page.getByRole("region", { name: "Action plan" });
  const send = wdw.getByTestId("plan-row-send_report");
  await expect(send).toHaveAttribute("data-me", "true");
  await expect(send).toHaveAttribute("data-state", "open");
  await expect(send).toContainText("Send approved report to Revolut Ltd");
  await expect(send.getByTestId("plan-time-send_report")).toContainText(/by \w{3} \d\d \w{3}$/);
  await expect(send.getByRole("button")).toHaveCount(0); // the one primary button is in Your next action
  const next = page.getByRole("region", { name: "Your next action" });
  await expect(next.getByTestId("next-action-title")).toHaveText("Send approved report to Revolut Ltd");
  await expect(next.getByRole("button", { name: "Record report sent" })).toBeVisible();
  await expect(wdw.getByTestId("plan-row-review_report")).toHaveCount(0); // approved: its Done line is below
  await expect(wdw.getByTestId("plan-done")).toContainText(/Resolved via ISS-\d{4} by Lukas Brenner at \w{3} \d\d \w{3}, \d\d:\d\d SGT/);
  await expect(wdw.getByTestId("plan-done")).toContainText("Draft shared by Lukas Brenner");
  await expect(wdw.getByTestId("plan-done")).toContainText("Root cause report approved by Mei Chen (Compliance)");
  // "Confirm resolution with the customer" is open right after resolution and does not wait for the report.
  await expect(wdw.getByTestId("plan-row-close")).toHaveAttribute("data-state", "open");
  await expect(page.getByText("Mei Chen (Compliance), root cause report")).toBeVisible();
  await expect(page.getByText("Post-incident report due")).toBeVisible();
  await expect(page.getByText("14 days after resolution", { exact: true })).toBeVisible();
});

test("only the owner sees the button, and the server answers 403 to anyone else", async ({ page, request }) => {
  const id = children["Revolut Ltd"].id;
  await signInAs(page, EMAIL.adrian);
  await page.goto(`/issues/${id}`);
  const send = page.getByRole("region", { name: "Action plan" }).getByTestId("plan-row-send_report");
  await expect(send).toContainText("Lukas Brenner");
  await expect(send.getByRole("button")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Record report sent" })).toHaveCount(0); // not the owner: no button anywhere

  const issue = await db.issue.findUniqueOrThrow({ where: { id } });
  const contact = await db.contact.findFirstOrThrow({ where: { entityId: issue.entityId, context: "CUSTOMER", role: "INCIDENT", status: "ACTIVE" } });
  for (const email of [EMAIL.adrian, EMAIL.mei, EMAIL.kevin]) {
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    const res = await request.post(`/api/issues/${id}/root-cause-report`, {
      headers: { cookie: `${SESSION_COOKIE}=${signUserCookie(user.id)}` },
      data: { sentAt: new Date().toISOString(), contactId: contact.id, channel: "EMAIL", summary: "A forged report summary.", version: issue.version },
    });
    expect(res.status(), email).toBe(403);
  }
  expect((await db.rootCauseReportTask.findUniqueOrThrow({ where: { issueId: id } })).sentAt).toBeNull();
});

test("Record report sent: the dialog, its checks, then the Done line, the communication log, the History and the move to the Resolved group", async ({ page }) => {
  const id = children["Revolut Ltd"].id;
  await signInAs(page, EMAIL.lukas);
  await page.goto(`/issues/${id}`);
  await page.getByRole("region", { name: "Your next action" }).getByRole("button", { name: "Record report sent" }).click();
  const dialog = page.getByRole("dialog", { name: "Record report sent" });

  await expect(dialog.getByLabel("Report link")).toHaveValue("https://docs.corvane-internal.example/reports/revolut-cop-gb-draft-2.pdf"); // prefilled from the (second) draft
  await expect(dialog.getByLabel("Summary")).toHaveValue(/Cause, impact \(with the customer count\)/); // the second draft replaced the first
  await expect(dialog).toContainText(/Root cause report for ISS-\d{4}, Revolut Ltd\. Due \w{3} \d\d \w{3}\./);
  await expect(dialog).toContainText("SGT"); // Sent on: the viewer's zone label
  await expect(dialog.getByRole("combobox", { name: "Sent to" })).toContainText("Priya Nair (Incident contact)"); // the primary incident contact
  const submit = dialog.getByRole("button", { name: "Record report sent" });
  await expect(submit).toBeDisabled(); // no channel yet

  await dialog.getByLabel("Summary").fill("Sent.");
  await expect(dialog.getByText("Enter at least 10 characters")).toBeVisible();
  await dialog.getByLabel("Report link").fill("https://evil.example/report.pdf");
  await expect(dialog.getByText("Enter a link starting with https://docs.corvane-internal.example/")).toBeVisible();

  // The dialog starts from the approved draft; the owner confirms Sent on, Sent to and Channel.
  await dialog.getByLabel("Summary").fill(DRAFT.draftSummary);
  await dialog.getByLabel("Report link").fill(DRAFT.draftLink);
  await dialog.getByRole("combobox", { name: "Channel" }).click();
  await page.getByRole("option", { name: "Email" }).click();
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.getByText("Report recorded")).toBeVisible();

  // Done line, with the link.
  const wdw = page.getByRole("region", { name: "Action plan" });
  const doneLines = wdw.getByTestId("plan-done-line");
  await expect(doneLines.filter({ hasText: "Resolved via" })).toHaveCount(1);
  const sent = doneLines.filter({ hasText: "Root cause report sent" });
  await expect(sent).toHaveCount(1);
  await expect(sent).toContainText(/Done: Root cause report sent \w{3} \d\d \w{3}, \d\d:\d\d SGT to Priya Nair by Lukas Brenner \(Network\)/);
  await expect(sent.getByRole("link", { name: "Root cause report" })).toHaveAttribute("href", DRAFT.draftLink);
  await expect(wdw.getByTestId("plan-row-send_report")).toHaveCount(0);
  await expect(wdw.getByTestId("plan-row-review_report")).toHaveCount(0);
  await expect(doneLines.filter({ hasText: "Draft shared by Lukas Brenner" })).toHaveCount(1);
  await expect(doneLines.filter({ hasText: "Root cause report approved by Mei Chen (Compliance)" })).toHaveCount(1); // by whoever actually approved
  await expect(doneLines.filter({ hasText: "completed when" })).toHaveCount(0); // recording the report never marks anyone else's step as done
  await expect(wdw.getByTestId("plan-row-close")).toHaveAttribute("data-state", "open"); // Confirm resolution with the customer stays open

  // One Done line per row, not one paragraph.
  expect(await doneLines.count()).toBeGreaterThanOrEqual(3);

  // Communication log.
  const log = page.getByRole("region", { name: "Communication log" });
  await expect(log).toContainText("Root cause report");
  await expect(log).toContainText("Priya Nair");
  await expect(log).toContainText("by Lukas Brenner");

  // History, under Incident, on the customer's record.
  const issue = await db.issue.findUniqueOrThrow({ where: { id } });
  await page.goto(`/entities/${issue.entityId}/history`);
  await expect(page.getByText("Root cause report sent to Priya Nair (Revolut Ltd). By Lukas Brenner, Network.")).toBeVisible();
  await expect(page.getByText(/Root cause report task created, due \d\d \w{3} 2026/)).toBeVisible();
  const events = await db.historyEvent.findMany({ where: { issueId: id, category: "INCIDENT", summary: { startsWith: "Root cause report" } } });
  expect(events).toHaveLength(5); // task created, draft shared twice (the first stays in History), approved, sent

  // Home: the issue left the main list for the Resolved group.
  await page.goto("/");
  await expect(page.getByTestId(`issue-row-${id}`)).toHaveCount(0);
  const toggle = page.getByRole("button", { name: /Resolved, waiting for the customer/ });
  await toggle.click();
  await expect(page.getByTestId(`issue-row-${id}`)).toBeVisible();
  // The other two tasks still wait for the owner to prepare them.
  for (const name of ["Santander UK plc", "Lloyds Bank plc"]) await expect(page.getByTestId(`line1-${children[name].id}`)).toHaveText(`Prepare root cause report for ${name}`);

  // And Mei has nothing to approve on this one any more; the other two wait on Lukas for a draft.
  await openMine(page, EMAIL.mei);
  await expect(page.getByTestId(`line1-${children["Santander UK plc"].id}`)).toHaveText("Waiting on Lukas Brenner (Owner): Share the draft");
  await expect(page.locator(`[data-testid="line1-${id}"]`)).toHaveCount(0);
});

test("Confirm resolution with the customer: open right after resolution (it did not wait for the report); Adrian closes the Revolut issue from Your next action, straight after Lukas resolved (no back-dating)", async ({ page }) => {
  const id = children["Revolut Ltd"].id;
  // Adrian has told the customer already (his Notify step is done), so Close is his next step.
  await db.issue.update({ where: { id }, data: { notifiedAt: new Date() } });
  await signInAs(page, EMAIL.adrian);
  await page.goto(`/issues/${id}`);
  const next = page.getByRole("region", { name: "Your next action" });
  await expect(next.getByTestId("next-action-title")).toHaveText("Confirm resolution with the customer");
  await expect(next.getByTestId("next-action-sub")).toHaveText(/Your role on ISS-\d{4}: Communicator$/);
  const messagePanel = page.getByRole("region", { name: "Message to the customer" });
  const panelClose = messagePanel.getByRole("button", { name: "Confirm resolution with the customer", exact: true });
  const isPrimary = async (loc: ReturnType<Page["locator"]>) => (await loc.evaluate((el) => el.className)).includes("bg-primary");
  // The one filled primary is the Message panel's own button; Your next action has a secondary one that scrolls to it.
  expect(await isPrimary(next.getByRole("button", { name: "Go to the message" }))).toBe(false);
  expect(await isPrimary(panelClose)).toBe(true);

  await next.getByRole("button", { name: "Go to the message" }).click();
  await expect(panelClose).toBeInViewport();
  await panelClose.click();
  const dialog = page.getByRole("dialog", { name: "Confirm resolution" });
  await dialog.getByRole("combobox", { name: "Customer confirmation from" }).click();
  await page.getByRole("option", { name: /Priya Nair/ }).click();
  await dialog.getByRole("combobox", { name: "Channel" }).click();
  await page.getByRole("option", { name: "Email" }).click();
  await dialog.getByRole("button", { name: "Confirm resolution" }).click();
  await expect(page.getByText("Resolution confirmed", { exact: true })).toBeVisible();
  // The report was sent earlier in this file, so the confirmation is the last step: the issue closes, and the confirmation is a Done line.
  expect((await db.issue.findUniqueOrThrow({ where: { id } })).status).toBe("CLOSED");
  await expect(page.getByRole("region", { name: "Action plan" }).getByTestId("plan-row-close")).toHaveCount(0);
  await expect(page.getByTestId("plan-done")).toContainText(/Done: Resolution confirmed by Adrian Koh/);
  await expect(page.getByRole("region", { name: "Your next action" }).getByTestId("next-action-title")).toContainText("Nothing for you to do");
});

test("the Compliance tab: Mei edits 'Post-incident report due (days)'; Adrian sees it read-only; the open task's deadline does not move", async ({ page }) => {
  const revolut = await db.entity.findFirstOrThrow({ where: { legalName: "Revolut Ltd" } });
  const lloydsChild = children["Lloyds Bank plc"].id;
  const taskBefore = await db.rootCauseReportTask.findUniqueOrThrow({ where: { issueId: children["Santander UK plc"].id } });

  await signInAs(page, EMAIL.adrian);
  await page.goto(`/entities/${revolut.id}/compliance`);
  const regulatory = page.getByText("Regulatory", { exact: true }).first();
  await expect(regulatory).toBeVisible();
  await expect(page.getByText("Post-incident report due (days)")).toBeVisible();
  await expect(page.getByText("4 of 4 captured")).toBeVisible();
  await expect(page.getByText("Owned by Compliance").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit" })).toHaveCount(0);

  await signInAs(page, EMAIL.mei);
  await page.goto(`/entities/${revolut.id}/compliance`);
  await page.getByRole("button", { name: "Edit" }).first().click();
  const days = page.getByLabel("Post-incident report due (days)");
  await expect(days).toHaveValue("14");
  await expect(page.getByText("Calendar days after resolution within which this customer needs Corvane's root cause report, as agreed in the contract.")).toBeVisible();
  await days.fill("120");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Enter a whole number of days between 1 and 90")).toBeVisible();
  await days.fill("21");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Obligations saved")).toBeVisible();
  const card = await db.obligationCard.findUniqueOrThrow({ where: { entityId_kind: { entityId: revolut.id, kind: "CUSTOMER_AGREEMENT" } } });
  expect(card.postIncidentReportDays).toBe(21);
  const audit = await db.auditEntry.findFirstOrThrow({ where: { objectId: card.id, field: "Post-incident report due" }, orderBy: { createdAt: "desc" } });
  expect([audit.oldValue, audit.newValue]).toEqual(["14 days", "21 days"]);

  // Regime None disables the field and clears it on save; the audit log keeps the old value.
  await page.getByRole("button", { name: "Edit" }).first().click();
  await page.getByRole("combobox", { name: "Regulatory regime" }).click();
  await page.getByRole("option", { name: /^None/ }).click();
  await expect(page.getByLabel("Post-incident report due (days)")).toBeDisabled();
  const saved = page.waitForResponse((r) => r.url().includes("/obligations/") && r.request().method() === "PUT");
  await page.getByRole("button", { name: "Save" }).click();
  expect((await saved).ok()).toBe(true);
  const cleared = await db.obligationCard.findUniqueOrThrow({ where: { id: card.id } });
  expect(cleared.postIncidentReportDays).toBeNull();
  const clearedAudit = await db.auditEntry.findFirstOrThrow({ where: { objectId: card.id, field: "Post-incident report due" }, orderBy: { createdAt: "desc" } });
  expect([clearedAudit.oldValue, clearedAudit.newValue]).toEqual(["21 days", null]);

  // Tasks that already exist keep the deadline they were created with (edge case 3).
  expect((await db.rootCauseReportTask.findUniqueOrThrow({ where: { issueId: children["Santander UK plc"].id } })).dueAt!.getTime()).toBe(taskBefore.dueAt!.getTime());
  expect((await db.rootCauseReportTask.findUniqueOrThrow({ where: { issueId: lloydsChild } })).reportDays).toBe(14);
});

/**
 * The dialogs prefill "now" when they OPEN, from the demo clock, never a value kept from page load; and the browser's demo clock can lag the
 * server's (its offset is taken when the page loads). A browser clock a day behind the server must not make the time look "before the resolution"
 * (the prefill is clamped to the resolution minute) or turn that time into "the future" (now is never earlier than the server's own time at render).
 */
async function lagBrowserClock(page: Page, hours: number) {
  const realNow = await page.evaluate(() => Date.now());
  await page.clock.setFixedTime(new Date(realNow - hours * 3_600_000));
}

test("Record report sent right after resolving, with the browser clock behind the server: the prefilled time is accepted and saves untouched", async ({ page, request }) => {
  const id = children["Santander UK plc"].id;
  await draftAndApprove(request, id);
  const issue = await db.issue.findUniqueOrThrow({ where: { id } });
  await signInAs(page, EMAIL.lukas);
  await page.goto(`/issues/${id}`);
  await lagBrowserClock(page, 24);

  await page.getByRole("region", { name: "Your next action" }).getByRole("button", { name: "Record report sent" }).click();
  const dialog = page.getByRole("dialog", { name: "Record report sent" });
  await dialog.getByRole("combobox", { name: "Channel" }).click();
  await page.getByRole("option", { name: "Email" }).click();
  await dialog.getByLabel("Summary").fill("Cause: partner gateway overload. Impact: UK CoP checks timed out. Fix: configuration rollback.");
  await expect(dialog.getByText(/can't be before Resolved at/)).toHaveCount(0);
  await expect(dialog.getByText("The time can't be in the future")).toHaveCount(0);
  const submit = dialog.getByRole("button", { name: "Record report sent" });
  await expect(submit).toBeEnabled();
  await submit.click(); // the time is not edited
  await expect(page.getByText("Report recorded")).toBeVisible();

  const task = await db.rootCauseReportTask.findUniqueOrThrow({ where: { issueId: id } });
  expect(task.sentAt!.getTime()).toBeGreaterThanOrEqual(Math.floor(issue.resolvedAt!.getTime() / 60_000) * 60_000);
});

test("Confirm resolution with the customer right after resolving, with the browser clock behind the server: the prefilled time is accepted and saves untouched", async ({ page }) => {
  const id = children["Lloyds Bank plc"].id;
  await db.issue.update({ where: { id }, data: { notifiedAt: new Date() } });
  await signInAs(page, EMAIL.adrian);
  await page.goto(`/issues/${id}`);
  await lagBrowserClock(page, 24);

  const next = page.getByRole("region", { name: "Your next action" });
  await next.getByRole("button", { name: "Go to the message" }).click();
  await page.getByRole("region", { name: "Message to the customer" }).getByRole("button", { name: "Confirm resolution with the customer", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Confirm resolution" });
  await dialog.getByRole("combobox", { name: "Customer confirmation from" }).click();
  await page.getByRole("option").first().click();
  await dialog.getByRole("combobox", { name: "Channel" }).click();
  await page.getByRole("option", { name: "Email" }).click();
  await expect(dialog.getByText("The time can't be in the future")).toHaveCount(0);
  const submit = dialog.getByRole("button", { name: "Confirm resolution" });
  await expect(submit).toBeEnabled();
  await submit.click(); // the time is not edited
  await expect(page.getByText("Resolution confirmed", { exact: true })).toBeVisible();
  expect((await db.issue.findUniqueOrThrow({ where: { id } })).status).toBe("RESOLVED"); // its report is still open: the issue closes when the report is sent
  expect(await db.issueCommunication.count({ where: { issueId: id, type: "CLOSURE_CONFIRMED" } })).toBe(1);
});
