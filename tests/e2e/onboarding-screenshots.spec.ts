import "dotenv/config";

import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { db } from "@/server/db";
import { CONTINUE_LABEL, STORAGE_KEYS } from "@/lib/onboarding/content";

import { EMAIL, resetDemoData, signInAs } from "./fixtures/role-actions-setup";

/**
 * Scenarios v2 screenshots at 1440 px: chapter 1 prologue and end, chapter 2 half way, scenario 2's prologue with the signal card, the
 * Report issue drawer with its hints. Runs only with SHOTS_DIR set.
 */

const DIR = process.env.SHOTS_DIR;

test.skip(!DIR, "SHOTS_DIR not set");
test.use({ storageState: { cookies: [], origins: [] } });

async function viewing(page: Page, who: string) {
  await expect.poll(async () => (await page.getByRole("combobox", { name: "View as" }).innerText()).trim()).toContain(who);
}

test("screenshots", async ({ page, request }) => {
  test.setTimeout(300_000);
  await page.context().route("https://mail.google.com/**", (r) => r.fulfill({ body: "ok" }));
  await resetDemoData(request);
  const shot = async (name: string) => {
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(DIR!, name) });
  };
  const iss = await db.issue.findUniqueOrThrow({ where: { number: 1042 } });
  const emma = await db.user.findUniqueOrThrow({ where: { email: "emma.wilson@corvane.example" } });
  const panel = page.getByRole("complementary", { name: /^Scenario/ });
  const step = (id: string) => panel.locator(`[data-onboarding-step="${id}"]`);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(
    ([welcome, panelKey]) => {
      localStorage.setItem(welcome, "1");
      if (!localStorage.getItem(panelKey)) localStorage.setItem(panelKey, JSON.stringify({ scenario: 1, chapter: "1a", collapsed: false, closedPrologues: [] }));
    },
    [STORAGE_KEYS.welcomeDismissed, STORAGE_KEYS.panel],
  );

  // Chapter 1, prologue.
  await signInAs(page, "emma.wilson@corvane.example");
  await page.goto("/");
  await expect(panel).toBeVisible();
  await expect(page.locator("#worklist-issues")).toBeVisible();
  await shot("1a-prologue.png");

  // Chapter 1, end: every step done.
  for (const id of ["s1-home", "s1-issue", "s1-log", "s1-compliance"]) {
    await step(id).getByRole("button", { name: "Take me there" }).click();
    await expect(step(id)).toHaveAttribute("data-done", "true", { timeout: 20_000 });
  }
  await db.issueCommunication.create({
    data: { issueId: iss.id, type: "UPDATE", occurredAt: new Date(), channel: "EMAIL", personName: "Silvia Moretti", message: "Update: the certificate is renewed and name checks are recovering.", recordedById: emma.id, recordedByName: emma.name },
  });
  await expect(step("s1-update")).toHaveAttribute("data-done", "true", { timeout: 20_000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await panel.evaluate((el) => (el.scrollTop = el.scrollHeight));
  await expect(page.getByRole("button", { name: CONTINUE_LABEL })).toBeVisible();
  await shot("1a-end-two-buttons.png");

  // Chapter 2, half way: Kevin resolved, Emma confirmed.
  await page.getByRole("button", { name: CONTINUE_LABEL }).click();
  await step("s1b-resolve").getByRole("button", { name: "Take me there" }).click();
  await viewing(page, "Kevin Lim");
  await page.getByRole("group", { name: "Issue actions" }).getByRole("button", { name: "Change status", exact: true }).click();
  const status = page.getByRole("dialog", { name: "Change status" });
  await status.getByRole("radio", { name: "Resolved" }).check();
  await status.getByLabel("Root cause").fill("The endpoint certificate expired after the rotation job failed.");
  await status.getByLabel("Solution").fill("Kevin renewed the certificate and fixed the rotation job.");
  await status.getByRole("button", { name: "Resolve issue" }).click();
  await expect(step("s1b-resolve")).toHaveAttribute("data-done", "true", { timeout: 20_000 });
  await step("s1b-confirm").getByRole("button", { name: "Take me there" }).click();
  await viewing(page, "Emma Wilson");
  await page.getByRole("region", { name: "Message to the customer" }).getByRole("button", { name: "Confirm resolution with the customer", exact: true }).click();
  const confirm = page.getByRole("dialog", { name: "Confirm resolution" });
  await confirm.getByRole("combobox", { name: "Channel" }).click();
  await page.getByRole("option", { name: "Email" }).click();
  await confirm.getByRole("button", { name: "Confirm resolution" }).click();
  await expect(step("s1b-confirm")).toHaveAttribute("data-done", "true", { timeout: 20_000 });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await step("s1b-share").getByRole("button", { name: "Take me there" }).click();
  await viewing(page, "Kevin Lim");
  await expect(page.getByRole("region", { name: "Action plan" })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot("1b-half-way.png");

  // Share draft with its hint.
  await page.getByRole("region", { name: "Your next action" }).getByRole("button", { name: "Share draft" }).click();
  await expect(page.locator('[data-onboarding-hint="draft-link"]')).toBeVisible();
  await shot("1b-share-draft-hint.png");
  await page.keyboard.press("Escape");

  // Scenario 2: prologue and signal card.
  await panel.getByRole("button", { name: "Switch to scenario 2" }).click();
  await expect(panel.locator('[data-onboarding="signal-card"]')).toBeVisible();
  await panel.evaluate((el) => (el.scrollTop = 0));
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot("2-prologue-signal.png");

  // The Lloyds Partner tab with its customers, as Lukas, the panel on step 1.
  await step("s2-impact").getByRole("button", { name: "Take me there" }).click();
  await viewing(page, "Lukas Brenner");
  await expect(page.getByTestId("coverage-customers").first()).toBeVisible();
  await expect(step("s2-impact")).toHaveAttribute("data-done", "true", { timeout: 20_000 });
  await panel.evaluate((el) => (el.scrollTop = 0));
  await page.waitForTimeout(800);
  await shot("2-lloyds-partner-customers.png");

  // The Report issue drawer with its hints.
  await signInAs(page, EMAIL.lukas);
  await page.goto("/");
  await page.getByRole("button", { name: "Report issue" }).click();
  const drawer = page.getByRole("dialog", { name: "Report issue" });
  await drawer.getByRole("combobox", { name: "Affected entity *" }).fill("Lloyds");
  await page.getByRole("option", { name: /Lloyds Bank plc/ }).first().click();
  await drawer.getByRole("combobox", { name: "Type" }).click();
  await page.getByRole("option", { name: "Partner degraded or unavailable" }).click();
  await expect(drawer.locator('[data-onboarding-hint="coverage"]')).toBeVisible();
  await shot("2-report-issue-hints.png");
});
