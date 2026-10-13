import "dotenv/config";

import { expect, test } from "@playwright/test";

import { db } from "@/server/db";

import { approveRootCauseReport, createLinkedIssueFixture, EMAIL, resolvePartnerWithCascade, shareRootCauseDraft, signInAs, type LinkedIssueFixture } from "./fixtures/role-actions-setup";

/**
 * Small fixes from the V7 design review. Runs only under the `role-actions` Playwright project (a production build, demo clock Mon 05 Oct 2026,
 * 10:05 CEST): Sev-1 spelled one way, a reason in the footer of every dialog with a disabled primary, the circle icon on every field error,
 * Approve report as a text link in the Action plan, one-line "Sent to", and a zone label in History.
 */

test.describe.configure({ mode: "serial" });

let fx: LinkedIssueFixture;

test.beforeAll(async ({ browser, request }) => {
  const page = await browser.newPage({ baseURL: "http://localhost:3104" });
  fx = await createLinkedIssueFixture(page, request);
  await page.close();
});

test("Home spells the severity Sev-1, as the issue page does", async ({ page }) => {
  await signInAs(page, EMAIL.lukas);
  await page.goto("/");
  const row = page.getByTestId(`issue-row-${fx.parentId}`);
  await expect(row).toContainText("Sev-1");
  await expect(page.locator("body")).not.toContainText(/\bSEV[1-4]\b/);
  await page.goto(`/issues/${fx.parentId}`);
  await expect(page.locator("body")).not.toContainText(/\bSEV[1-4]\b/);
});

test("Resolve issue says in the footer what is missing; its field errors carry the circle icon", async ({ page }) => {
  await signInAs(page, EMAIL.lukas);
  await page.goto(`/issues/${fx.parentId}`);
  await page.getByRole("button", { name: "Acknowledge" }).click();
  await expect(page.getByText("Issue acknowledged")).toBeVisible();
  await page.goto(`/issues/${fx.parentId}`);
  await page.getByRole("group", { name: "Issue actions" }).getByRole("button", { name: "Change status", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Change status" });
  await dialog.getByRole("radio", { name: "Resolved" }).check();
  const reason = dialog.getByTestId("dialog-blocked-reason");
  await expect(reason).toHaveText("Write at least 20 characters in Root cause");
  await dialog.getByLabel("Root cause").fill("Lloyds CoP gateway overloaded after a configuration change on their side.");
  await expect(reason).toHaveText("Write at least 20 characters in Solution");
  await dialog.getByLabel("Solution").fill("Lloyds rolled back the change; response times are back under one second.");
  await expect(reason).toHaveText("Enter the event date and time");
  // An Event after Corvane aware at: the error under the field has the circle icon, the footer says to fix the time.
  await dialog.getByTestId("resolve-event-date").fill("2026-10-06");
  await dialog.getByTestId("resolve-event-time").fill("10:00");
  await expect(reason).toHaveText("Fix the event time");
  const error = dialog.getByRole("alert").filter({ hasText: "Event can't be after" });
  await expect(error.locator("svg")).toHaveCount(1);
  await expect(dialog.getByRole("button", { name: "Resolve issue" })).toBeDisabled();
});

test("Approve report is a text link in the Action plan row, the one filled primary stays in Your next action; Request changes checks its reason with an icon and a footer reason", async ({ page, request }) => {
  await signInAs(page, EMAIL.lukas);
  await resolvePartnerWithCascade(page, fx, { alreadyAcknowledged: true });
  await shareRootCauseDraft(request, fx.childId);
  // Mei has assessed and Adrian has notified, so the report review is her one open step.
  const mei = await db.user.findUniqueOrThrow({ where: { email: EMAIL.mei } });
  await db.complianceAssessment.create({ data: { issueId: fx.childId, outcome: "NEITHER", rationale: "Assessed for the test: no major incident.", assessedById: mei.id, assessedAt: new Date() } });
  await db.issue.update({ where: { id: fx.childId }, data: { notifiedAt: new Date() } });
  await signInAs(page, EMAIL.mei);
  await page.goto(`/issues/${fx.childId}`);
  const row = page.getByRole("region", { name: "Action plan" }).getByTestId("plan-row-review_report");
  const rowApprove = row.getByRole("button", { name: "Approve report" });
  await expect(rowApprove).toBeVisible();
  await expect(rowApprove).not.toHaveClass(/bg-primary/);
  await expect(rowApprove).not.toHaveClass(/(^|\s)border(\s|$)/);
  await expect(row.getByRole("button", { name: "Request changes" })).not.toHaveClass(/border-primary/);
  const next = page.getByRole("region", { name: "Your next action" });
  await expect(next.getByRole("button", { name: "Approve report" })).toHaveClass(/bg-primary/);
  await expect(page.locator("button.bg-primary", { hasText: "Approve report" })).toHaveCount(1);

  await next.getByRole("button", { name: "Request changes" }).click();
  const dialog = page.getByRole("dialog", { name: "Request changes to the root cause report" });
  await dialog.getByLabel("Reason *").fill("Too short");
  await expect(dialog.getByTestId("dialog-blocked-reason")).toHaveText("Write at least 10 characters");
  await dialog.getByLabel("Reason *").fill("Short");
  const err = dialog.getByRole("alert").filter({ hasText: "Enter 10 to 2,000 characters" });
  await expect(err.locator("svg")).toHaveCount(1);
});

test("Record report sent: Sent to is one left-aligned line with an ellipsis, and the footer names what is missing", async ({ page, request }) => {
  await approveRootCauseReport(request, fx.childId);
  await signInAs(page, EMAIL.lukas);
  await page.goto(`/issues/${fx.childId}`);
  await page.getByRole("region", { name: "Your next action" }).getByRole("button", { name: "Record report sent" }).click();
  const dialog = page.getByRole("dialog", { name: "Record report sent" });
  const trigger = dialog.getByRole("combobox", { name: "Sent to" });
  await expect(trigger).toContainText("(Incident contact)");
  const style = await trigger.locator("> span").first().evaluate((el) => {
    const s = getComputedStyle(el);
    return { align: s.textAlign, overflow: s.overflow, ellipsis: s.textOverflow, nowrap: s.whiteSpace, height: el.getBoundingClientRect().height };
  });
  expect(style).toMatchObject({ align: "left", overflow: "hidden", ellipsis: "ellipsis", nowrap: "nowrap" });
  expect(style.height).toBeLessThan(26);
  await dialog.getByLabel("Summary").fill("x");
  await expect(dialog.getByTestId("dialog-blocked-reason").or(dialog.locator("#record-blocked-reason"))).toBeVisible();
});

test("History gives the zone label the rest of the app uses, never UTC+hh:mm", async ({ page }) => {
  await signInAs(page, EMAIL.adrian);
  const revolut = await db.entity.findFirstOrThrow({ where: { legalName: "Revolut Ltd" } });
  await page.goto(`/entities/${revolut.id}/history`);
  await expect(page.getByText(/linked issue|Issue ISS-/i).first()).toBeVisible();
  const text = await page.locator("main").innerText();
  expect(text).not.toMatch(/UTC[+-]\d\d:\d\d/);
  expect(text).toMatch(/\d\d:\d\d (CEST|CET|MYT|SGT)/);
});
