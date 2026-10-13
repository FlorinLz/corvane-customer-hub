import "dotenv/config";

import path from "node:path";

import { expect, test } from "@playwright/test";

import { db } from "@/server/db";

import { createLinkedIssueFixture, EMAIL, signInAs } from "./fixtures/role-actions-setup";

/**
 * UX polish: Home (Adrian) after the partner scenario, the partner issue (Lukas), the Revolut linked issue (Adrian and Mei) and the Report issue
 * drawer with its errors, at 1440 and 1024 px, against a production build (the `role-actions` project). Runs only with SHOTS_DIR set.
 */

const DIR = process.env.SHOTS_DIR;
test.skip(!DIR, "SHOTS_DIR not set");

test("ux polish screenshots", async ({ page, request }) => {
  test.setTimeout(300_000);
  const fx = await createLinkedIssueFixture(page, request); // the Lloyds partner issue and its linked Revolut issue
  // The partner issue's acknowledgement started 3 h 43 min before it was reported: 3 h 28 min overdue, so the Overdue time shows on Home.
  const parent = await db.issue.findUniqueOrThrow({ where: { id: fx.parentId } });
  await db.issue.update({ where: { id: fx.parentId }, data: { ackStartAt: new Date(parent.createdAt.getTime() - 223 * 60_000), clocksStartAt: new Date(parent.createdAt.getTime() - 223 * 60_000) } });

  const shoot = async (name: string, email: string, url: string, ready: RegExp) => {
    await signInAs(page, email);
    for (const width of [1440, 1024]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(url);
      await expect(page.getByRole("heading", { name: ready }).first()).toBeVisible();
      await page.waitForTimeout(700);
      await page.screenshot({ path: path.join(DIR!, `${name}-${width}.png`), fullPage: true });
    }
  };

  await shoot("Home-Adrian", EMAIL.adrian, "/", /^Issues/);
  await shoot("Partner-issue-Lukas", EMAIL.lukas, `/issues/${fx.parentId}`, /^Action plan$/);
  await shoot("Revolut-linked-issue-Adrian", EMAIL.adrian, `/issues/${fx.childId}`, /^Action plan$/);
  await shoot("Revolut-linked-issue-Mei", EMAIL.mei, `/issues/${fx.childId}`, /^Action plan$/);

  // The Report issue drawer with its errors: the entity is picked, nothing else is filled in, and Report issue is clicked.
  await signInAs(page, "emma.wilson@corvane.example");
  for (const width of [1440, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.getByRole("button", { name: "Report issue" }).click();
    const drawer = page.getByRole("dialog", { name: "Report issue" });
    await drawer.getByRole("combobox", { name: "Affected entity *" }).fill("revolut");
    await page.getByRole("option", { name: /Revolut Ltd/ }).click();
    await drawer.getByRole("button", { name: "Report issue" }).click();
    await expect(drawer.getByText("Choose the issue type")).toBeVisible();
    await page.waitForTimeout(900); // the scroll to the first invalid field settles
    await page.screenshot({ path: path.join(DIR!, `Report-issue-drawer-errors-${width}.png`) });
    await page.keyboard.press("Escape");
  }
});
