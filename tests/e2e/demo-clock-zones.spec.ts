import "dotenv/config";

import { expect, test } from "@playwright/test";

import { db } from "@/server/db";
import { signUserCookie, SESSION_COOKIE } from "@/server/session";

/**
 * Milestone 8 live fix. Runs only under the `demo-clock-zones` Playwright
 * project: a real production build (`next build && next start`, not
 * `next dev` -- see playwright.config.ts) with the browser's own system
 * zone pinned to Europe/Bucharest, deliberately *not* the viewer's
 * configured zone (CEST). The user's own reported production bug,
 * verbatim: viewer Emma Wilson (effective zone CEST), browser zone
 * Europe/Bucharest (EEST, UTC+3), demo clock strip showing 13:14 CEST,
 * ISS-1042 (MPS) Resolved at 12:52 CEST -- entering 13:10 in the Close
 * dialog's time field failed with "The time can't be before Resolved at
 * (12:52 CEST)" because the field parsed 13:10 in the *browser's* zone
 * (EEST), one hour ahead of the viewer's own CEST, landing before
 * Resolved at instead of 18 minutes after it.
 *
 * Every date/time field in the app must parse in the *viewer's* zone
 * regardless of the browser's own (src/lib/time-zones.ts's
 * zonedDateTimeToUtc / splitInZone); this spec proves that end to end,
 * against a production build, in a browser whose own zone actively
 * disagrees with the viewer's.
 */

test.describe.configure({ mode: "serial" });

async function resetDemoData(request: import("@playwright/test").APIRequestContext) {
  const adrian = await db.user.findUniqueOrThrow({ where: { email: "adrian.koh@corvane.example" } });
  const cookie = `${SESSION_COOKIE}=${signUserCookie(adrian.id)}`;
  const res = await request.post("/api/demo/reset", { headers: { cookie } });
  expect(res.ok()).toBe(true);
}

test("every date/time field parses and labels the viewer's own zone, never the browser's", async ({ page, request }) => {
  await resetDemoData(request);

  const emma = await db.user.findUniqueOrThrow({ where: { email: "emma.wilson@corvane.example" } });
  await page.context().addCookies([{ name: SESSION_COOKIE, value: signUserCookie(emma.id), domain: "localhost", path: "/" }]);

  const mps = await db.entity.findFirstOrThrow({ where: { legalName: "Banca Monte dei Paschi di Siena S.p.A." } });
  const issue1042 = await db.issue.findFirstOrThrow({ where: { number: 1042 } });

  // Step 1: Report issue (entity header) -- prefill passes with no edits, zone label visible.
  await page.goto(`/entities/${mps.id}/overview`);
  await page.getByRole("button", { name: "Report issue" }).first().click();
  const reportDrawer = page.getByRole("dialog", { name: "Report issue" });
  // Corvane aware at and Event each carry the zone label.
  await expect(reportDrawer.getByText("CEST", { exact: true })).toHaveCount(2);
  await expect(reportDrawer.getByText("Corvane aware at can't be in the future")).not.toBeVisible();
  await page.keyboard.press("Escape");

  // Step 2: Record notification, on ISS-1042 (Emma is its communicator by now) -- same checks.
  await page.goto(`/issues/${issue1042.id}`);
  await page.getByRole("region", { name: "Message to the customer" }).getByRole("button", { name: "Record update" }).click(); // ISS-1042 already has its first notification
  const recordDialog = page.getByRole("dialog", { name: "Record notification" });
  await expect(recordDialog.getByText("CEST", { exact: true })).toBeVisible();
  await expect(recordDialog.getByText("The time can't be in the future")).not.toBeVisible();
  await page.keyboard.press("Escape");

  // Step 3: directly resolve ISS-1042 at a known, fixed instant (12:52 CEST) -- the
  // real "Change status" flow always resolves at the *current* demo-clock instant,
  // which this spec cannot pin to a specific past value, so this is fixture setup,
  // not a shortcut around the thing under test (the Close dialog's own parsing).
  await db.issue.update({
    where: { id: issue1042.id },
    data: { status: "RESOLVED", resolvedAt: new Date("2026-10-06T10:52:00.000Z") }, // 12:52 CEST
  });

  // Step 4: Close dialog -- prefill passes with no edits, zone label visible.
  await page.goto(`/issues/${issue1042.id}`);
  await page.getByRole("region", { name: "Message to the customer" }).getByRole("button", { name: "Confirm resolution with the customer", exact: true }).click();
  const closeDialog = page.getByRole("dialog", { name: "Confirm resolution" });
  await expect(closeDialog.getByText("CEST", { exact: true })).toBeVisible();
  await expect(closeDialog.getByText("The time can't be in the future")).not.toBeVisible();
  await expect(closeDialog.getByText(/can't be before Resolved at/)).not.toBeVisible();

  // Step 5: the exact reported scenario -- enter 13:10 (18 minutes after Resolved at
  // 12:52 CEST, 4 minutes before the demo clock's own ~13:14 CEST "now").
  await closeDialog.getByRole("combobox", { name: "Customer confirmation from" }).click();
  await page.getByRole("option", { name: "Silvia Moretti" }).click();
  await closeDialog.getByRole("combobox", { name: "Channel" }).click();
  await page.getByRole("option", { name: "Email" }).click();
  await closeDialog.locator('input[type="time"]').fill("13:10");

  await expect(closeDialog.getByText(/can't be/)).not.toBeVisible();
  await closeDialog.getByRole("button", { name: "Confirm resolution" }).click();
  await expect(page.getByText("Resolution confirmed", { exact: true })).toBeVisible();

  const closure = await db.issueCommunication.findFirstOrThrow({ where: { issueId: issue1042.id, type: "CLOSURE_CONFIRMED" } });
  expect(closure.occurredAt.toISOString()).toBe(new Date(Date.UTC(2026, 9, 6, 11, 10)).toISOString()); // 13:10 CEST = 11:10 UTC
  const closed = await db.issue.findUniqueOrThrow({ where: { id: issue1042.id } });
  expect(closed.status).toBe("CLOSED");
});
