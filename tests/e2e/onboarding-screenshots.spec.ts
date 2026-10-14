import "dotenv/config";

import path from "node:path";

import { expect, test } from "@playwright/test";

import { db } from "@/server/db";
import { WELCOME } from "@/lib/onboarding/content";

import { resetDemoData, signInAs } from "./fixtures/role-actions-setup";

/**
 * Onboarding PR screenshots: the welcome card, scenario 1's panel on ISS-1042 and one "Why this?" popover at 1440 px, the mobile notice at
 * 390 px. Runs only with SHOTS_DIR set.
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
  await page.goto("/");
  await expect(page.getByRole("complementary", { name: "Welcome" })).toBeVisible();
  await expect(page.locator("#worklist-issues")).toBeVisible();
  await page.waitForTimeout(600);
  await shot("1440-welcome-card.png");

  // Scenario 1 on ISS-1042, as Emma, with the first steps done.
  await signInAs(page, "emma.wilson@corvane.example");
  await page.goto("/");
  await page.getByRole("button", { name: WELCOME.scenario1 }).click();
  await page.getByRole("complementary", { name: "Scenario 1" }).locator("[data-onboarding-step]").nth(0).getByRole("button", { name: "Take me there" }).click();
  await expect(page.locator('[data-onboarding-step="s1-home"]')).toHaveAttribute("data-done", "true", { timeout: 15_000 });
  await page.locator('[data-onboarding-step="s1-issue"]').getByRole("button", { name: "Take me there" }).click();
  await expect(page).toHaveURL(new RegExp(`/issues/${iss1042.id}$`));
  await expect(page.locator('[data-onboarding-step="s1-issue"]')).toHaveAttribute("data-done", "true", { timeout: 15_000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(800);
  await shot("1440-scenario-1-panel-ISS-1042.png");

  // One popover: Your next action.
  await page.locator('[data-onboarding-why="next-action"]').click();
  await expect(page.locator('[data-onboarding-popover="next-action"]')).toBeVisible();
  await shot("1440-why-this-popover.png");

  // Mobile notice.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => localStorage.clear());
  await page.goto("/");
  await expect(page.locator('[data-onboarding="mobile-notice"]')).toBeVisible();
  await page.waitForTimeout(400);
  await shot("390-mobile-notice.png");
});
