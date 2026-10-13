import "dotenv/config";

import path from "node:path";

import { expect, test } from "@playwright/test";

import { db } from "@/server/db";

import { approveRootCauseReport, createLinkedIssueFixture, EMAIL, resolvePartnerWithCascade, signInAs } from "./fixtures/role-actions-setup";

/**
 * Root cause report PR: Lukas's Home, the linked Revolut issue as Lukas before and after recording the report, the dialog,
 * and Revolut's Compliance tab as Mei Chen, at 1440 and 1024 px. Runs only with SHOTS_DIR set; SHOTS_PREFIX "before" (run on
 * main, where the task does not exist) takes only the screens that exist there, "after" takes all of them.
 */

const DIR = process.env.SHOTS_DIR;
const PREFIX = process.env.SHOTS_PREFIX ?? "after";
const AFTER = PREFIX !== "before";

test.skip(!DIR, "SHOTS_DIR not set");

test("screenshots", async ({ page, request, context }) => {
  test.setTimeout(300_000);
  await context.route("https://mail.google.com/**", (r) => r.fulfill({ body: "ok" }));
  const fx = await createLinkedIssueFixture(page, request);
  await resolvePartnerWithCascade(page, fx);
  const revolut = await db.entity.findFirstOrThrow({ where: { legalName: "Revolut Ltd" } });

  const shot = async (name: string, width: number, fullPage = true) => {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(DIR!, `${PREFIX}-${name}-${width}.png`), fullPage });
  };
  const open = async (email: string, url: string, ready: string | RegExp) => {
    await signInAs(page, email);
    await page.goto(url);
    await expect(page.getByRole("heading", { name: ready }).first()).toBeVisible();
  };

  for (const width of [1440, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await open(EMAIL.lukas, "/", /^Issues/);
    await shot("home-lukas", width);
    await open(EMAIL.lukas, `/issues/${fx.childId}`, /^People$/);
    await shot("issue-revolut-lukas", width);
    await open(EMAIL.mei, `/entities/${revolut.id}/compliance`, /Compliance/);
    await shot("compliance-revolut-mei", width);
  }
  if (!AFTER) return;

  // Compliance approves first; then the dialog, empty and filled, and the issue after recording.
  await approveRootCauseReport(request, fx.childId);
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(EMAIL.lukas, `/issues/${fx.childId}`, /^People$/);
  await page.getByRole("button", { name: "Record report sent" }).click();
  const dialog = page.getByRole("dialog", { name: "Record report sent" });
  await expect(dialog).toBeVisible();
  await shot("dialog-record-report", 1440, false);
  await dialog.getByRole("combobox", { name: "Channel" }).click();
  await page.getByRole("option", { name: "Email" }).click();
  await dialog.getByLabel("Report link").fill("https://docs.corvane-internal.example/reports/revolut-cop-gb.pdf");
  await dialog.getByLabel("Summary").fill("Cause: partner gateway overload. Impact: UK CoP checks timed out for 52 minutes. Fix: configuration rollback and a new alert on gateway latency.");
  await shot("dialog-record-report-filled", 1440, false);
  await dialog.getByRole("button", { name: "Record report sent" }).click();
  await expect(page.getByText("Report recorded")).toBeVisible();
  await page.waitForTimeout(600);
  for (const width of [1440, 1024]) {
    await shot("issue-revolut-lukas-recorded", width);
  }
  await open(EMAIL.lukas, "/", /^Issues/);
  await page.getByRole("button", { name: /Resolved, waiting for the customer/ }).click();
  await shot("home-lukas-recorded", 1440);

  // Compliance editing the field.
  await open(EMAIL.mei, `/entities/${revolut.id}/compliance`, /Compliance/);
  await page.getByRole("button", { name: "Edit" }).first().click();
  await expect(page.getByLabel("Post-incident report due (days)")).toBeVisible();
  await shot("compliance-revolut-mei-edit", 1440);
});
