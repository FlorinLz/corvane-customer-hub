import "dotenv/config";

import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { db } from "@/server/db";
import { STORAGE_KEYS } from "@/lib/onboarding/content";

import { EMAIL, resetDemoData, signInAs } from "./fixtures/role-actions-setup";

/** Next-step screenshots at 1440 px: the highlight on Resolve, inside the Share draft dialog, on Acknowledge, the panel states, the wrong-person line. Runs only with SHOTS_DIR set. */
const DIR = process.env.SHOTS_DIR;

test.skip(!DIR, "SHOTS_DIR not set");
test.use({ storageState: { cookies: [], origins: [] } });

test("screenshots", async ({ page, request }) => {
  test.setTimeout(300_000);
  await page.context().route("https://mail.google.com/**", (r) => r.fulfill({ body: "ok" }));
  await resetDemoData(request);
  const shot = async (name: string, p: Page = page) => {
    await p.waitForTimeout(900);
    await p.screenshot({ path: path.join(DIR!, name) });
  };
  const iss = await db.issue.findUniqueOrThrow({ where: { number: 1042 } });
  const emma = await db.user.findUniqueOrThrow({ where: { email: "emma.wilson@corvane.example" } });
  const panel = page.getByRole("complementary", { name: /^Scenario/ });
  const step = (id: string) => panel.locator(`[data-onboarding-step="${id}"]`);
  const highlight = page.locator("[data-onboarding-highlight]");
  const setPanel = (scenario: 1 | 2, chapter: string) =>
    page.addInitScript(
      ([welcome, panelKey, pref]) => {
        localStorage.setItem(welcome, "1");
        localStorage.setItem(panelKey, pref);
      },
      [STORAGE_KEYS.welcomeDismissed, STORAGE_KEYS.panel, JSON.stringify({ scenario, chapter, collapsed: false, closedPrologues: [], openedPrologues: [] })],
    );

  await page.setViewportSize({ width: 1440, height: 900 });
  await db.issueCommunication.create({
    data: { issueId: iss.id, type: "UPDATE", occurredAt: new Date(), channel: "EMAIL", personName: "Silvia Moretti", message: "Update: name checks are recovering.", recordedById: emma.id, recordedByName: emma.name },
  });

  // 1b step 1: the highlight on Resolve, as Kevin.
  await setPanel(1, "1b");
  await signInAs(page, EMAIL.kevin);
  await page.goto(`/issues/${iss.id}`);
  await expect(highlight).toBeVisible({ timeout: 20_000 });
  await shot("1b-step1-resolve-highlight.png");

  // The wrong-person line: the same step, viewed as Emma.
  await signInAs(page, "emma.wilson@corvane.example");
  await page.goto(`/issues/${iss.id}`);
  await expect(page.locator('[data-onboarding="wrong-person"]')).toBeVisible();
  await shot("wrong-persona-line.png");

  // 1b step 3, inside the Share draft dialog: do steps 1 and 2 through the data, then open the dialog as Kevin.
  await signInAs(page, EMAIL.kevin);
  await page.goto(`/issues/${iss.id}`);
  await page.locator('[data-onboarding="next-action"] [data-onboarding="resolve"]').click();
  const status = page.getByRole("dialog", { name: "Change status" });
  await status.getByLabel("Root cause").fill("The endpoint certificate expired after the rotation job failed.");
  await status.getByLabel("Solution").fill("Kevin renewed the certificate and fixed the rotation job.");
  await status.getByRole("button", { name: "Resolve issue" }).click();
  await expect(page.getByText("Issue resolved")).toBeVisible();
  await signInAs(page, "emma.wilson@corvane.example");
  await page.goto(`/issues/${iss.id}`);
  await page.locator('[data-onboarding="confirm-resolution"]').click();
  const confirm = page.getByRole("dialog", { name: "Confirm resolution" });
  await confirm.getByRole("combobox", { name: "Channel" }).click();
  await page.getByRole("option", { name: "Email" }).click();
  await confirm.getByRole("button", { name: "Confirm resolution" }).click();
  await expect(page.getByText("Resolution confirmed", { exact: true })).toBeVisible();
  await signInAs(page, EMAIL.kevin);
  await page.goto(`/issues/${iss.id}`);
  await page.locator('[data-onboarding="next-action"] [data-onboarding="share-draft"]').click();
  await expect(page.getByRole("dialog", { name: "Share draft of the root cause report" })).toBeVisible();
  await expect(highlight).toHaveAttribute("data-onboarding-highlight", "use-example-link", { timeout: 20_000 });
  await shot("1b-step3-share-draft-highlight.png");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");

  // The panel with done, current and later steps: steps 1 and 2 are done, step 3 is open.
  await expect(step("s1b-resolve")).toHaveAttribute("data-state", "done");
  await expect(step("s1b-share")).toHaveAttribute("data-state", "current");
  await shot("panel-done-current-later.png");

  // Scenario 2 step 3, on Acknowledge: Lukas reports the Lloyds issue (steps 1 and 2 done), then the partner issue shows the highlight.
  await resetDemoData(request);
  const p2 = await page.context().newPage(); // a second page, so the scenario 1 preference above is not re-applied on its loads
  const step2 = (id: string) => p2.getByRole("complementary", { name: /^Scenario/ }).locator(`[data-onboarding-step="${id}"]`);
  const highlight2 = p2.locator("[data-onboarding-highlight]");
  await p2.setViewportSize({ width: 1440, height: 900 });
  await p2.addInitScript(([welcome, panelKey, pref]) => { localStorage.setItem(welcome, "1"); localStorage.setItem(panelKey, pref); }, [STORAGE_KEYS.welcomeDismissed, STORAGE_KEYS.panel, JSON.stringify({ scenario: 2, chapter: "2", collapsed: false, closedPrologues: [], openedPrologues: [] })]);
  await signInAs(p2, EMAIL.lukas);
  const lloyds = await db.entity.findFirstOrThrow({ where: { legalName: "Lloyds Bank plc" } });
  await p2.goto(`/entities/${lloyds.id}/overview`);
  await p2.getByRole("button", { name: "Report issue" }).click();
  const drawer = p2.getByRole("dialog", { name: "Report issue" });
  await drawer.getByRole("combobox", { name: "Type" }).click();
  await p2.getByRole("option", { name: "Partner degraded or unavailable" }).click();
  await drawer.getByRole("radio", { name: /UK CoP \/ GB/ }).check();
  await drawer.getByLabel("Description").fill("Lloyds Bank plc CoP responses time out. Revolut Ltd payee checks on UK CoP GB return no result.");
  await drawer.getByRole("combobox", { name: "Reported at the customer by" }).click();
  await p2.getByRole("option", { name: "Found by Corvane" }).click();
  await drawer.getByRole("radio", { name: "Down" }).check();
  await drawer.getByRole("radio", { name: "No" }).check();
  await drawer.getByRole("button", { name: "Report issue" }).click();
  await expect(p2).toHaveURL(/\/issues\/.+\?reported=1/);
    await expect(step2("s2-impact")).toBeVisible();
  // Step 1 is a "viewed" step, so mark it read through the Partner tab first.
  await step2("s2-impact").getByRole("button", { name: "Take me there" }).click();
  await expect(step2("s2-impact")).toHaveAttribute("data-state", "done", { timeout: 20_000 });
  const parentUrl = await db.issue.findFirstOrThrow({ where: { entityId: lloyds.id }, orderBy: { number: "desc" } });
  await p2.goto(`/issues/${parentUrl.id}`);
  await expect(step2("s2-degraded")).toHaveAttribute("data-state", "current");
  await expect(highlight2).toHaveAttribute("data-onboarding-highlight", "next-action/acknowledge", { timeout: 20_000 });
  await shot("2-step3-acknowledge-highlight.png", p2);
});
