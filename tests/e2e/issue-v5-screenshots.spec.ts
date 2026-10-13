import "dotenv/config";

import path from "node:path";

import { expect, test } from "@playwright/test";

import { db } from "@/server/db";

import { approveRootCauseReport, createLinkedIssueFixture, EMAIL, resolvePartnerWithCascade, signInAs } from "./fixtures/role-actions-setup";

/**
 * Issue page v5 and Home issues table: the Home tables (Adrian, Lukas) and the issue pages (ISS-1046 as Adrian and Lukas, ISS-1038 as Kevin, ISS-1042 as Emma) at 1440 and 1024 px. Runs only with SHOTS_DIR set (it writes PNGs there).
 */

const DIR = process.env.SHOTS_DIR;
test.skip(!DIR, "SHOTS_DIR not set");

test("v5 screenshots", async ({ page, request, context }) => {
  test.setTimeout(300_000);
  await context.route("https://mail.google.com/**", (r) => r.fulfill({ body: "ok" }));
  const fx = await createLinkedIssueFixture(page, request);
  const iss1038 = await db.issue.findFirstOrThrow({ where: { number: 1038 } });
  const iss1042 = await db.issue.findFirstOrThrow({ where: { number: 1042 } });

  const shoot = async (name: string, email: string, url: string, ready: RegExp) => {
    await signInAs(page, email);
    for (const width of [1440, 1024]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(url);
      await expect(page.getByRole("heading", { name: ready }).first()).toBeVisible();
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(DIR!, `${name}${width === 1024 ? "-1024" : ""}.png`), fullPage: true });
    }
  };

  // Before the partner issue is resolved.
  await shoot("Home-Table-Adrian", EMAIL.adrian, "/", /^Issues/);
  await shoot("Issue-ISS-1046-Adrian", EMAIL.adrian, `/issues/${fx.childId}`, /^Action plan$/);
  await shoot("Issue-ISS-1046-Lukas", EMAIL.lukas, `/issues/${fx.childId}`, /^Action plan$/);
  await shoot("Issue-ISS-1038-Kevin", EMAIL.kevin, `/issues/${iss1038.id}`, /^Action plan$/);
  await shoot("Issue-ISS-1042-Emma", "emma.wilson@corvane.example", `/issues/${iss1042.id}`, /^Action plan$/);

  // The partner issue itself, as its owner Lukas, before and after he resolves it (Confirm resolution with the partner).
  await shoot("Issue-ISS-1043-Partner-Lukas", EMAIL.lukas, `/issues/${fx.parentId}`, /^Action plan$/);

  // After Lukas resolves the partner issue with the cascade, and then after he records the Revolut report.
  await signInAs(page, EMAIL.lukas);
  await resolvePartnerWithCascade(page, fx);
  await shoot("Issue-ISS-1043-Partner-Lukas-Resolved", EMAIL.lukas, `/issues/${fx.parentId}`, /^Action plan$/);
  await shoot("Home-Table-Lukas", EMAIL.lukas, "/", /^Issues/);
  await shoot("Issue-ISS-1046-Report-Lukas", EMAIL.lukas, `/issues/${fx.childId}`, /^Action plan$/);

  await approveRootCauseReport(request, fx.childId);
  await signInAs(page, EMAIL.lukas);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/issues/${fx.childId}`);
  await page.getByRole("region", { name: "Your next action" }).getByRole("button", { name: "Record report sent" }).click();
  const dialog = page.getByRole("dialog", { name: "Record report sent" });
  await dialog.getByRole("combobox", { name: "Channel" }).click();
  await page.getByRole("option", { name: "Email" }).click();
  await dialog.getByLabel("Report link").fill("https://docs.corvane-internal.example/reports/revolut-cop-gb.pdf");
  await dialog.getByLabel("Summary").fill("Cause: partner gateway overload. Impact: UK CoP checks timed out. Fix: configuration rollback and a new latency alert.");
  await dialog.getByRole("button", { name: "Record report sent" }).click();
  await expect(page.getByText("Report recorded")).toBeVisible();
  await shoot("Issue-ISS-1046-Report-Sent-Lukas", EMAIL.lukas, `/issues/${fx.childId}`, /^Action plan$/);
});
