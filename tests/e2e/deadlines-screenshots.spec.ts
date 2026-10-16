import path from "node:path";

import { expect, test } from "@playwright/test";

import { adminPool, as, issueId, newVisitor, wipeSandboxes } from "./fixtures/sandbox-visitor";

/** Deadline screenshots at 1440 px, Mon 05 Oct 2026 10:05 CEST: three Homes, ISS-1042's Action plan, a paused clock. Runs only with SHOTS_DIR set. */
const DIR = process.env.SHOTS_DIR;

test.skip(!DIR, "SHOTS_DIR not set");
test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: 1440, height: 900 } });

test("screenshots", async ({ browser }) => {
  test.setTimeout(240_000);
  const admin = adminPool();
  await wipeSandboxes(admin);
  const v = await newVisitor(browser);
  const { page } = v;
  const shot = async (name: string, fullPage = false) => {
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(DIR!, name), fullPage });
  };

  for (const [file, email, who] of [
    ["emma-home.png", "emma.wilson@corvane.example", "Emma Wilson"],
    ["kevin-home.png", "kevin.lim@corvane.example", "Kevin Lim"],
    ["lukas-home.png", "lukas.brenner@corvane.example", "Lukas Brenner"],
  ] as const) {
    await as(v.context, email);
    await page.goto("/");
    await expect(page.locator("#worklist-issues")).toBeVisible();
    await expect(page.locator('[data-testid^="time-block-"]').first()).toBeVisible();
    await expect(page.getByText(`${who} ·`).first()).toBeVisible();
    await shot(file);
  }

  // ISS-1042's Action plan, as Emma: the night in order, the restore, the facts, her next update.
  await as(v.context, "emma.wilson@corvane.example");
  await page.goto(`/issues/${issueId(1042)}`);
  const plan = page.getByRole("region", { name: "Action plan" });
  await expect(plan).toBeVisible();
  await plan.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
  await plan.screenshot({ path: path.join(DIR!, "iss-1042-action-plan.png") });
  await shot("iss-1042-page.png", true);

  // A paused clock: Adrian puts ISS-1025 (Nordea, Sev-2) on Waiting on customer. Restore and Resolve stop; the plan says Paused.
  await as(v.context, "adrian.koh@corvane.example");
  await page.goto(`/issues/${issueId(1025)}`);
  await page.getByRole("group", { name: "Issue actions" }).getByRole("button", { name: "Change status", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Change status" });
  await dialog.getByRole("radio", { name: "Waiting on customer" }).check();
  await dialog.getByRole("button", { name: "Change status" }).click();
  await expect(page.getByText("Status changed")).toBeVisible();
  await expect(page.getByTestId("plan-time-restore")).toHaveAttribute("data-state", "paused");
  const paused = page.getByRole("region", { name: "Action plan" });
  await paused.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
  await paused.screenshot({ path: path.join(DIR!, "paused-clock-action-plan.png") });
  await page.goto("/");
  await expect(page.locator("#worklist-issues")).toBeVisible();
  await shot("paused-clock-adrian-home.png");

  await v.context.close();
  await wipeSandboxes(admin);
  await admin.end();
});
