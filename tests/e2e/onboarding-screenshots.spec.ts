import "dotenv/config";

import path from "node:path";

import { expect, test } from "@playwright/test";

import { db } from "@/server/db";
import { WELCOME } from "@/lib/onboarding/content";

import { resetDemoData, signInAs } from "./fixtures/role-actions-setup";

/**
 * Onboarding v2 screenshots: the three steps of the welcome modal and one "Why this?" popover at 1440 px. Runs only with SHOTS_DIR set.
 */

const DIR = process.env.SHOTS_DIR;

test.skip(!DIR, "SHOTS_DIR not set");
test.use({ storageState: { cookies: [], origins: [] } });

test("screenshots", async ({ page, request }) => {
  test.setTimeout(180_000);
  await resetDemoData(request);
  const shot = (name: string) => page.screenshot({ path: path.join(DIR!, name) });
  const iss1042 = await db.issue.findUniqueOrThrow({ where: { number: 1042 } });

  await page.setViewportSize({ width: 1440, height: 900 });
  await signInAs(page, "emma.wilson@corvane.example");
  await page.goto("/");
  await expect(page.locator("#worklist-issues")).toBeVisible();
  await page.waitForTimeout(600);
  await shot("1440-welcome-step-1.png");
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("dialog", { name: WELCOME.step2.title })).toBeVisible();
  await shot("1440-welcome-step-2.png");
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("dialog", { name: WELCOME.step3.title })).toBeVisible();
  await shot("1440-welcome-step-3.png");

  await page.getByRole("button", { name: WELCOME.step3.explore }).click();
  await page.goto(`/issues/${iss1042.id}`);
  await page.locator('[data-onboarding-why="next-action"]').click();
  await expect(page.locator('[data-onboarding-popover="next-action"]')).toBeVisible();
  await shot("1440-why-this-popover.png");
});
