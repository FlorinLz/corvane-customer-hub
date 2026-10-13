import "dotenv/config";

import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { db } from "@/server/db";

import { createLinkedIssueFixture, EMAIL, signInAs } from "./fixtures/role-actions-setup";

/**
 * Event, awareness and opened times: the Report issue, Correct times and Resolve dialogs and their error states at 1440 and 1024 px. The issue pages (Issue-ISS-1038-Kevin, -1042-Emma, -1046-*) come from issue-v5-screenshots.spec.ts.
 * Runs only with SHOTS_DIR set (it writes PNGs there).
 */

const DIR = process.env.SHOTS_DIR;
test.skip(!DIR, "SHOTS_DIR not set");

function minus(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const t = h * 60 + m - minutes;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

test("times screenshots", async ({ page, request, context }) => {
  test.setTimeout(300_000);
  await context.route("https://mail.google.com/**", (r) => r.fulfill({ body: "ok" }));
  const fx = await createLinkedIssueFixture(page, request);
  const iss1038 = await db.issue.findFirstOrThrow({ where: { number: 1038 } });
  const revolut = await db.entity.findFirstOrThrow({ where: { legalName: "Revolut Ltd" } });

  const shot = async (name: string, width: number) => {
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(DIR!, `${name}${width === 1024 ? "-1024" : ""}.png`), fullPage: true });
  };

  // Report issue drawer, Emma Wilson on Revolut Ltd: filled in, then the order error.
  for (const width of [1440, 1024]) {
    await signInAs(page, "emma.wilson@corvane.example");
    await page.setViewportSize({ width, height: 1500 });
    await page.goto(`/entities/${revolut.id}/overview`);
    await page.getByRole("button", { name: "Report issue" }).click();
    const drawer = page.getByRole("dialog", { name: "Report issue" });
    await drawer.getByRole("combobox", { name: "Type" }).click();
    await page.getByRole("option", { name: "Wrong match result" }).click();
    await drawer.getByRole("combobox", { name: "Product line" }).click();
    await page.getByRole("option", { name: /UK CoP \/ GB/ }).click();
    await drawer.getByLabel("Description").fill("Trade-name payees return No match since this morning.");
    await drawer.getByRole("combobox", { name: "Reported at the customer by" }).click();
    await page.getByRole("option").first().click();
    await drawer.getByRole("radio", { name: "Degraded" }).check();
    await drawer.getByRole("radio", { name: "No" }).check();
    const awareTime = await drawer.getByTestId("report-times-aware-time").inputValue();
    await drawer.getByTestId("report-times-aware-time").fill(minus(awareTime, 60));
    await drawer.getByTestId("report-times-event-date").fill(await drawer.getByTestId("report-times-aware-date").inputValue());
    await drawer.getByTestId("report-times-event-time").fill(minus(awareTime, 80));
    await shot("Report-Issue-Times", width);
    await drawer.getByTestId("report-times-event-time").fill(minus(awareTime, 30)); // after Corvane aware at
    await expect(drawer.getByText("Event can't be after Corvane aware at")).toBeVisible();
    await shot("Report-Issue-Times-Error", width);
  }

  // Correct times, Kevin Lim on ISS-1038: filled in, the error state, then the Timeline after the correction.
  for (const width of [1440, 1024]) {
    await signInAs(page, EMAIL.kevin);
    await page.setViewportSize({ width, height: 1100 });
    await page.goto(`/issues/${iss1038.id}`);
    await page.getByTestId("correct-times-link").click();
    const dialog = page.getByRole("dialog", { name: "Correct times" });
    const awareTime = await dialog.getByTestId("correct-times-aware-time").inputValue();
    const eventTime = await dialog.getByTestId("correct-times-event-time").inputValue();
    await dialog.getByTestId("correct-times-aware-time").fill(minus(awareTime, 10));
    await dialog.getByTestId("correct-times-event-time").fill(minus(eventTime, 10));
    await dialog.getByLabel("Reason *").fill("The customer email reached the shared mailbox before it was read. The gateway showed it late.");
    await shot("Correct-Times-Dialogs", width);
    await dialog.getByTestId("correct-times-event-time").fill(minus(awareTime, -5)); // after Corvane aware at
    await dialog.getByLabel("Reason *").fill("Typo");
    await expect(dialog.getByText("Event can't be after Corvane aware at")).toBeVisible();
    await shot("Correct-Times-Dialogs-Error", width);
    await page.keyboard.press("Escape");
  }

  await signInAs(page, EMAIL.kevin);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto(`/issues/${iss1038.id}`);
  await page.getByTestId("correct-times-link").click();
  const correct = page.getByRole("dialog", { name: "Correct times" });
  const aware = await correct.getByTestId("correct-times-aware-time").inputValue();
  const event = await correct.getByTestId("correct-times-event-time").inputValue();
  await correct.getByTestId("correct-times-aware-time").fill(minus(aware, 10));
  await correct.getByTestId("correct-times-event-time").fill(minus(event, 10));
  await correct.getByLabel("Reason *").fill("The customer email reached the shared mailbox before it was read. The gateway showed it late.");
  await correct.getByRole("button", { name: "Save correction" }).click();
  await expect(page.getByText("Times corrected")).toBeVisible();
  for (const width of [1440, 1024]) {
    await page.setViewportSize({ width, height: 1100 });
    await page.goto(`/issues/${iss1038.id}`);
    await page.getByTestId("timeline-correction").getByText(/^Corrected by/).hover();
    await expect(page.getByRole("tooltip")).toBeVisible();
    await shot("Correct-Times-Timeline", width);
    await page.goto(`/entities/${revolut.id}/history`);
    await expect(page.getByText(/Corvane aware at corrected from/).first()).toBeVisible();
    await shot("Correct-Times-History", width);
  }

  // Resolve with Event: the partner issue (Sev-1), reported with Event empty (Unknown), as its owner Lukas Brenner.
  for (const width of [1440, 1024]) {
    await signInAs(page, EMAIL.lukas);
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`/issues/${fx.parentId}`);
    if (width === 1440) {
      await page.getByRole("button", { name: "Acknowledge" }).click();
      await expect(page.getByText("Issue acknowledged")).toBeVisible();
      await page.goto(`/issues/${fx.parentId}`);
    }
    await openResolve(page);
    const dialog = page.getByRole("dialog", { name: "Change status" });
    await dialog.getByLabel("Root cause").fill("Lloyds Bank plc CoP responses timed out after a failed certificate rotation.");
    await dialog.getByLabel("Solution").fill("Lloyds Bank plc restored the CoP endpoint and the probes pass again.");
    await shot("Resolve-Event-Dialog", width);
    await dialog.getByTestId("resolve-event-date").fill("2026-10-05");
    await dialog.getByTestId("resolve-event-time").fill("23:10");
    await expect(dialog.getByText(/^Event can't be after Corvane aware at/)).toBeVisible();
    await shot("Resolve-Event-Dialog-Error", width);
  }
});

async function openResolve(page: Page) {
  await page.getByRole("group", { name: "Issue actions" }).getByRole("button", { name: "Change status", exact: true }).click();
  await page.getByRole("dialog", { name: "Change status" }).getByRole("radio", { name: "Resolved" }).check();
}
