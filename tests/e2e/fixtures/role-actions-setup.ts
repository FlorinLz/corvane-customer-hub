import "dotenv/config";

import { expect, type APIRequestContext, type Page } from "@playwright/test";

import { db } from "@/server/db";
import { signUserCookie, SESSION_COOKIE } from "@/server/session";

import { resetDemoData } from "./reset";

/**
 * Shared by role-actions.spec.ts and role-actions-screenshots.spec.ts. Both run
 * against a production build on the "role-actions" project's own port, whose
 * demo clock starts at Mon 05 Oct 2026, 10:48 CEST (the demo time).
 */

export { resetDemoData };

export async function signInAs(page: Page, email: string) {
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  await page.context().clearCookies();
  await page.context().addCookies([{ name: SESSION_COOKIE, value: signUserCookie(user.id), domain: "localhost", path: "/" }]);
  return user;
}

export const EMAIL = {
  adrian: "adrian.koh@corvane.example",
  kevin: "kevin.lim@corvane.example",
  lukas: "lukas.brenner@corvane.example",
  mei: "mei.chen@corvane.example",
};

export interface LinkedIssueFixture {
  parentId: string;
  parentDisplayId: string;
  /** Revolut Ltd's CREATED linked issue: Lukas owns it through the parent, Adrian (Revolut's owner) is its communicator. */
  childId: string;
  childDisplayId: string;
}

const display = (n: number) => `ISS-${String(n).padStart(4, "0")}`;

/**
 * Lukas Brenner (Network) reports a Sev-1 partner outage at Lloyds Bank plc, UK CoP / GB, and fans it
 * out to the affected customers: Revolut Ltd gets a linked issue (owner Lukas, communicator Adrian Koh).
 * Leaves the page signed in as Lukas.
 */
export async function createLinkedIssueFixture(page: Page, request: APIRequestContext): Promise<LinkedIssueFixture> {
  await resetDemoData(request);
  await signInAs(page, EMAIL.lukas);

  const lloyds = await db.entity.findFirstOrThrow({ where: { legalName: "Lloyds Bank plc" } });
  await page.goto(`/entities/${lloyds.id}/overview`);
  await page.getByRole("button", { name: "Report issue" }).click();
  const drawer = page.getByRole("dialog", { name: "Report issue" });
  await drawer.getByRole("combobox", { name: "Type" }).click();
  await page.getByRole("option", { name: "Partner degraded or unavailable" }).click();
  await drawer.getByRole("radio", { name: /UK CoP \/ GB/ }).check(); // Lloyds has three coverages: pick the one, no scheme or country to type
  await drawer.getByLabel("Description").fill("Lloyds Bank plc CoP responses time out. Revolut Ltd payee checks on UK CoP GB return no result.");
  await drawer.getByRole("combobox", { name: "Reported at the customer by" }).click();
  await page.getByRole("option", { name: "Found by Corvane" }).click();
  await drawer.getByRole("radio", { name: "Down" }).check();
  await drawer.getByRole("radio", { name: "No" }).check();
  await drawer.getByRole("button", { name: "Report issue" }).click();

  await expect(page).toHaveURL(/\/issues\/.+\?reported=1/);
  const parentId = page.url().match(/\/issues\/([^/?]+)/)![1];
  const parent = await db.issue.findUniqueOrThrow({ where: { id: parentId } });

  await page.getByRole("button", { name: "Create linked issues" }).click();
  const dialog = page.getByRole("dialog", { name: "Create linked issues" });
  await dialog.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByText("Linked issues created")).toBeVisible();

  const link = await db.issueLink.findFirstOrThrow({
    where: { parentId, kind: "CREATED", unlinkedAt: null, child: { entity: { legalName: "Revolut Ltd" } } },
    include: { child: true },
  });
  return { parentId, parentDisplayId: display(parent.number), childId: link.childId, childDisplayId: display(link.child.number) };
}

/** Lukas (signed in) acknowledges the partner issue and resolves it, confirming the cascade to every linked issue. */
export async function resolvePartnerWithCascade(page: Page, fx: Pick<LinkedIssueFixture, "parentId">, opts: { alreadyAcknowledged?: boolean } = {}) {
  await page.goto(`/issues/${fx.parentId}`);
  if (!opts.alreadyAcknowledged) {
    await page.getByRole("button", { name: "Acknowledge" }).click();
    await expect(page.getByText("Issue acknowledged")).toBeVisible();
    await page.goto(`/issues/${fx.parentId}`);
  }
  await page.getByRole("group", { name: "Issue actions" }).getByRole("button", { name: "Change status", exact: true }).click();
  const statusDialog = page.getByRole("dialog", { name: "Change status" });
  await statusDialog.getByRole("radio", { name: "Resolved" }).check();
  await statusDialog.getByLabel("Root cause").fill("Lloyds CoP gateway overloaded after a configuration change on their side.");
  await statusDialog.getByLabel("Solution").fill("Lloyds rolled back the change; response times are back under one second.");
  // The partner issue is Sev-1 and was reported with Event empty (Unknown): Resolve needs Event, in Lukas's zone (SGT), an hour before Corvane aware at.
  const parent = await db.issue.findUniqueOrThrow({ where: { id: fx.parentId } });
  const event = new Date(parent.awareAt.getTime() - 60 * 60_000);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(event);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  await statusDialog.getByTestId("resolve-event-date").fill(`${get("year")}-${get("month")}-${get("day")}`);
  await statusDialog.getByTestId("resolve-event-time").fill(`${get("hour")}:${get("minute")}`);
  await statusDialog.getByRole("button", { name: "Resolve issue" }).click();
  const confirmDialog = page.getByRole("dialog", { name: "Resolve with linked issues" });
  await confirmDialog.getByRole("button", { name: "Resolve" }).click();
  await expect(page.getByText("Issue resolved")).toBeVisible();
}

/** The owner (Lukas Brenner) shares a draft of a root cause report through the real endpoint: the first of the three steps. */
export async function shareRootCauseDraft(request: APIRequestContext, issueId: string, ownerEmail: string = EMAIL.lukas) {
  const owner = await db.user.findUniqueOrThrow({ where: { email: ownerEmail } });
  const issue = await db.issue.findUniqueOrThrow({ where: { id: issueId } });
  const res = await request.post(`/api/issues/${issueId}/root-cause-report/draft`, {
    headers: { cookie: `${SESSION_COOKIE}=${signUserCookie(owner.id)}` },
    data: { draftLink: "https://docs.corvane-internal.example/reports/draft-1.pdf", draftSummary: "Cause: partner gateway overload. Impact: UK CoP checks timed out. Fix: configuration rollback.", version: issue.version },
  });
  expect(res.ok()).toBe(true);
}

/** The owner shares the draft (if it is not shared yet) and Compliance (Mei Chen) approves it: the owner can record the report as sent only after this. */
export async function approveRootCauseReport(request: APIRequestContext, issueId: string, email: string = EMAIL.mei) {
  const task = await db.rootCauseReportTask.findUniqueOrThrow({ where: { issueId } });
  if (!task.draftSharedAt) await shareRootCauseDraft(request, issueId);
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  const res = await request.post(`/api/issues/${issueId}/root-cause-report/approve`, { headers: { cookie: `${SESSION_COOKIE}=${signUserCookie(user.id)}` }, data: {} });
  expect(res.ok()).toBe(true);
}
