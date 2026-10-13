import "dotenv/config";

import { expect, test, type Locator, type Page } from "@playwright/test";

import { db } from "@/server/db";

import { createLinkedIssueFixture, EMAIL, signInAs, type LinkedIssueFixture } from "./fixtures/role-actions-setup";

/**
 * UX polish checks. Runs only under the `role-actions` Playwright project: a production build, demo clock Mon 05 Oct 2026, 10:48 CEST.
 * Home rows never overflow a cell (an overdue time wraps under its own "Overdue" line; the deadline of a context line stays visible when the
 * action text is long), the Message panel says "All messages sent" when nothing is left, and the Report issue drawer marks and checks its
 * required fields.
 */

test.describe.configure({ mode: "serial" });

let fx: LinkedIssueFixture;

test.beforeAll(async ({ browser, request }) => {
  const page = await browser.newPage({ baseURL: "http://localhost:3104" });
  fx = await createLinkedIssueFixture(page, request);
  await page.close();
});

/** Every visible element inside `cell` ends at or before the cell's right edge: nothing spills into the next column. Text clipped by a truncating ancestor is not spilling. */
async function overflowing(cell: Locator): Promise<string[]> {
  return cell.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const clipped = (d: HTMLElement) => {
      for (let a = d.parentElement; a && a !== el; a = a.parentElement) if (getComputedStyle(a).overflowX !== "visible") return true;
      return false;
    };
    return [...el.querySelectorAll<HTMLElement>("*")]
      .filter((d) => d.getBoundingClientRect().width > 0 && d.getBoundingClientRect().right > box.right + 1 && !clipped(d))
      .map((d) => `${d.tagName} ${d.textContent?.slice(0, 40)}`);
  });
}

async function openHome(page: Page, email: string, width: number) {
  await signInAs(page, email);
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Issues" }).getByRole("heading", { name: /^Issues/ })).toBeVisible();
}

test.describe("Home rows", () => {
  for (const width of [1440, 1024]) {
    test(`an overdue time wraps under its own Overdue line and nothing overflows a cell at ${width} px`, async ({ page }) => {
      // The partner issue's acknowledgement started 3 h 43 min before the demo time: 15 min target, so 3 h 28 min overdue.
      const parent = await db.issue.findUniqueOrThrow({ where: { id: fx.parentId } });
      await db.issue.update({ where: { id: fx.parentId }, data: { ackStartAt: new Date(parent.createdAt.getTime() - 223 * 60_000), clocksStartAt: new Date(parent.createdAt.getTime() - 223 * 60_000) } });

      await openHome(page, EMAIL.lukas, width);
      const row = page.getByTestId(`issue-row-${fx.parentId}`);
      const time = row.getByTestId(`time-block-${fx.parentId}`);
      await expect(time).toHaveAttribute("data-state", "over");
      // "Overdue" is its own small red line above the duration.
      await expect(time.locator("span").first()).toHaveText("Overdue");
      await expect(time.locator("span").nth(1)).toHaveText(/^\d+ h( \d+ min)?$|^\d+ min$/);
      await expect(time).toContainText(/^Overdue \d+ (h|min)/);

      // No cell of any row spills into its neighbour.
      const rows = page.locator('[data-testid^="issue-row-"]');
      const count = await rows.count();
      for (let i = 0; i < count; i++) {
        const cells = rows.nth(i).locator("> div");
        for (let c = 0; c < (await cells.count()); c++) {
          if (!(await cells.nth(c).isVisible())) continue;
          expect(await overflowing(cells.nth(c)), `row ${i}, cell ${c}`).toEqual([]);
        }
      }
    });
  }

  test("the deadline of a context line stays visible at 1024 px when the action text is long; only the text truncates, with the full text as its title", async ({ page }) => {
    await openHome(page, EMAIL.lukas, 1024);
    const line2 = page.getByTestId(`line2-${fx.childId}`);
    await expect(line2).toBeVisible();
    // A long action text: the communicator's step on the linked issue, made longer, so the text cannot fit its column.
    await line2.evaluate((el) => {
      const first = el.querySelector<HTMLElement>("span > span");
      if (first) first.textContent = `${first.textContent} and a long extra explanation that cannot fit in the column next to its deadline at all`;
    });
    const phrase = line2.locator("span.shrink-0").first();
    await expect(phrase).toBeVisible();
    expect(await phrase.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    const cellBox = await page.getByTestId(`issue-row-${fx.childId}`).locator("> div").last().boundingBox();
    const phraseBox = await phrase.boundingBox();
    expect(phraseBox!.x + phraseBox!.width).toBeLessThanOrEqual(cellBox!.x + cellBox!.width + 1);
    const text = line2.locator("span.truncate").first();
    expect(await text.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true); // the text is what gives way
    await expect(text.locator("xpath=..")).toHaveAttribute("title", /.+/);
  });
});

test.describe("Message panel", () => {
  test("once every message is recorded the panel says so and keeps no editable template", async ({ page }) => {
    const child = await db.issue.findUniqueOrThrow({ where: { id: fx.childId } });
    const adrian = await db.user.findUniqueOrThrow({ where: { email: EMAIL.adrian } });
    const at = new Date(child.createdAt.getTime() + 60_000);
    await db.issue.update({ where: { id: fx.childId }, data: { status: "RESOLVED", resolvedAt: at, notifiedAt: at, version: { increment: 1 } } });
    await db.issueCommunication.create({
      data: { issueId: fx.childId, type: "CLOSURE_CONFIRMED", occurredAt: at, channel: "EMAIL", personName: "Priya Nair", recordedById: adrian.id, recordedByName: "Adrian Koh", message: "Confirmed.", createdAt: at },
    });

    await signInAs(page, EMAIL.adrian);
    await page.goto(`/issues/${fx.childId}`);
    const panel = page.getByRole("region", { name: "Message to the customer" });
    await expect(panel.getByTestId("all-messages-sent")).toHaveText("All messages sent. See the Communication log.");
    await expect(panel.getByLabel("Subject")).toHaveCount(0);
    await expect(panel.getByLabel("Body")).toHaveCount(0);
    await expect(panel.getByRole("button")).toHaveCount(0);
  });
});

test.describe("Report issue drawer", () => {
  test("required fields carry a *; Report issue stays enabled and, with fields missing, shows the errors and goes to the first one", async ({ page }) => {
    await signInAs(page, "emma.wilson@corvane.example");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await page.getByRole("button", { name: "Report issue" }).click();
    const drawer = page.getByRole("dialog", { name: "Report issue" });
    await drawer.getByRole("combobox", { name: "Affected entity *" }).fill("revolut");
    await page.getByRole("option", { name: /Revolut Ltd/ }).click();

    for (const label of ["Type *", "Description *", "Corvane aware at *", "Source *", "Reported at the customer by *", "Impact *", "Possible data breach *"]) {
      await expect(drawer.getByText(label, { exact: true }), label).toBeVisible();
    }
    const submit = drawer.getByRole("button", { name: "Report issue" });
    await expect(submit).toBeEnabled();
    await submit.click();

    await expect(drawer).toBeVisible();
    await expect(page).not.toHaveURL(/\/issues\//);
    for (const message of ["Choose the issue type", "Describe the issue in at least 20 characters", "Choose who reported it", "Select the impact", "Select Yes or No"]) {
      await expect(drawer.getByText(message), message).toBeVisible();
    }
    // The first invalid field has focus and every error is linked to its field.
    await expect(drawer.getByRole("combobox", { name: "Type *" })).toBeFocused();
    await expect(drawer.getByRole("combobox", { name: "Type *" })).toHaveAttribute("aria-invalid", "true");
    await expect(drawer.getByRole("combobox", { name: "Type *" })).toHaveAttribute("aria-describedby", "report-issue-type-error");

    // The errors go as the fields are filled in.
    await drawer.getByRole("combobox", { name: "Type *" }).click();
    await page.getByRole("option", { name: "Billing" }).click();
    await expect(drawer.getByText("Choose the issue type")).toHaveCount(0);
  });
});
