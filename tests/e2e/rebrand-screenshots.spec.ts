import "dotenv/config";

import path from "node:path";

import { expect, test } from "@playwright/test";

import { db } from "@/server/db";

import { signInAs } from "./fixtures/role-actions-setup";

/**
 * The Corvane wordmark and the demo bar's fictional-data notice: Home as Adrian, the MPS issue page (ISS-1042) as Emma and the
 * Report issue drawer, at 1440 px. Runs only with SHOTS_DIR set (it writes PNGs there).
 */

const DIR = process.env.SHOTS_DIR;
test.skip(!DIR, "SHOTS_DIR not set");

test("rebrand screenshots", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });

  await signInAs(page, "adrian.koh@corvane.example");
  await page.goto("/");
  await expect(page.getByText("Demo with fictional data. Bank names are illustrative; the incidents are invented.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Corvane Customer Hub, go to Home" })).toBeVisible();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(DIR!, "home-adrian-1440.png"), fullPage: true });

  const iss1042 = await db.issue.findFirstOrThrow({ where: { number: 1042 } });
  await signInAs(page, "emma.wilson@corvane.example");
  await page.goto(`/issues/${iss1042.id}`);
  await expect(page.getByRole("heading", { name: /^Action plan$/ }).first()).toBeVisible();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(DIR!, "issue-mps-iss-1042-emma-1440.png"), fullPage: true });

  await page.goto("/");
  await page.getByRole("button", { name: "Report issue" }).click();
  const drawer = page.getByRole("dialog", { name: "Report issue" });
  await expect(drawer.getByRole("combobox", { name: "Affected entity *" })).toBeFocused();
  await drawer.getByRole("combobox", { name: "Affected entity *" }).fill("revolut");
  await page.getByRole("option", { name: /Revolut Ltd/ }).click();
  await drawer.getByRole("combobox", { name: "Type" }).click();
  await page.getByRole("option", { name: "Billing" }).click();
  await expect(drawer.getByText(/When the signal reached Corvane/)).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(DIR!, "report-issue-drawer-1440.png") });
});
