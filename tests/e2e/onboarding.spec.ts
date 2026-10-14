import "dotenv/config";

import { expect, test, type Page } from "@playwright/test";

import { db } from "@/server/db";
import { DECISIONS_URL, NOTES, SCENARIOS, START_HERE_URL, STORAGE_KEYS, WELCOME, type NoteKey } from "@/lib/onboarding/content";

import { EMAIL, createLinkedIssueFixture, resetDemoData, signInAs, type LinkedIssueFixture } from "./fixtures/role-actions-setup";

/**
 * First-visit onboarding: the welcome card, the scenario panel and its data checks, the "Why this?" notes, the mobile notice.
 * Runs on the role-actions project's production build (Mon 05 Oct 2026). Every test starts from an empty browser storage (the config
 * dismisses the card for the other specs), so each one is a first visit.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const EMMA = "emma.wilson@corvane.example";

async function viewingAs(page: Page): Promise<string> {
  return (await page.getByRole("combobox", { name: "View as" }).innerText()).trim();
}

test.describe("welcome card", () => {
  test("a first visit shows the card; closing remembers it; the ? in the demo bar brings it back", async ({ page }) => {
    await page.goto("/");
    const card = page.getByRole("complementary", { name: "Welcome" });
    await expect(card).toBeVisible();
    await expect(card.getByRole("heading", { name: WELCOME.title })).toBeVisible();
    await expect(card).toContainText("Corvane checks payee names between banks.");
    await expect(card).toContainText("Built by Florin Lazar, Product Manager. Fictional data; the demo resets itself.");
    await expect(card.getByRole("button", { name: WELCOME.scenario1 })).toBeVisible();
    await expect(card.getByRole("button", { name: WELCOME.scenario2 })).toBeVisible();
    await expect(card.getByRole("link", { name: WELCOME.howBuilt })).toHaveAttribute("href", START_HERE_URL);
    await expect(card.getByRole("link", { name: WELCOME.decisions })).toHaveAttribute("href", DECISIONS_URL);
    // At most 60 words of text, not counting the buttons and links.
    const words = [WELCOME.title, WELCOME.intro, WELCOME.by].join(" ").split(/\s+/).length;
    expect(words).toBeLessThanOrEqual(60);

    // It never blocks the app: the page behind it still works while it is open.
    await expect(page.locator("#worklist-issues")).toBeVisible();

    await card.getByRole("button", { name: WELCOME.explore }).click();
    await expect(card).toHaveCount(0);
    expect(await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEYS.welcomeDismissed)).toBe("1");

    await page.reload();
    await expect(page.locator("#worklist-issues")).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Welcome" })).toHaveCount(0);

    await page.getByRole("button", { name: "About this demo" }).click();
    await expect(page.getByRole("complementary", { name: "Welcome" })).toBeVisible();
    await page.getByRole("button", { name: "Close welcome card" }).click();
    await expect(page.getByRole("complementary", { name: "Welcome" })).toHaveCount(0);
  });

  test("with storage blocked the card shows once per page load and can still be closed", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        get() {
          throw new DOMException("blocked", "SecurityError");
        },
      });
    });
    await page.goto("/");
    const card = page.getByRole("complementary", { name: "Welcome" });
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Close welcome card" }).click();
    await expect(card).toHaveCount(0);
    // Navigating inside the app does not bring it back; a new page load does (nothing was remembered).
    await page.goto("/");
    await expect(page.getByRole("complementary", { name: "Welcome" })).toBeVisible();
  });
});

test.describe("scenario 1: the night Sev-1", () => {
  test.beforeEach(async ({ request }) => {
    test.setTimeout(180_000);
    await resetDemoData(request);
  });

  test("Take me there switches the person and opens the right page for each step; the checks turn done from what was viewed and from the data", async ({ page }) => {
    const iss1042 = await db.issue.findUniqueOrThrow({ where: { number: 1042 } });
    await page.goto("/");
    await page.getByRole("button", { name: WELCOME.scenario1 }).click();

    const panel = page.getByRole("complementary", { name: "Scenario 1" });
    await expect(panel).toBeVisible();
    expect((await panel.boundingBox())!.width).toBe(360);
    await expect(panel.getByRole("heading", { name: SCENARIOS[1].title })).toBeVisible();
    const steps = panel.locator("[data-onboarding-step]");
    await expect(steps).toHaveCount(5);
    for (let i = 0; i < 5; i++) await expect(steps.nth(i)).toHaveAttribute("data-done", "false");
    // The card is gone once a scenario starts, and the page narrows to make room for the panel.
    await expect(page.getByRole("complementary", { name: "Welcome" })).toHaveCount(0);
    expect(await page.evaluate(() => getComputedStyle(document.body).paddingRight)).toBe("360px");

    // a. Home as Emma Wilson.
    await steps.nth(0).getByRole("button", { name: "Take me there" }).click();
    await expect.poll(() => viewingAs(page)).toContain("Emma Wilson");
    await expect(page).toHaveURL(/\/$/);
    await expect(steps.nth(0)).toHaveAttribute("data-done", "true", { timeout: 15_000 });

    // b. ISS-1042: she stays Emma; the page is the issue.
    await steps.nth(1).getByRole("button", { name: "Take me there" }).click();
    await expect(page).toHaveURL(new RegExp(`/issues/${iss1042.id}$`));
    await expect(page.getByRole("region", { name: "Action plan" })).toBeVisible();
    await expect(steps.nth(1)).toHaveAttribute("data-done", "true", { timeout: 15_000 });

    // c. Communication log, d. Compliance card: each is done once it has been in view.
    await expect(steps.nth(2)).toHaveAttribute("data-done", "false");
    await steps.nth(2).getByRole("button", { name: "Take me there" }).click();
    await expect(page.getByRole("region", { name: "Communication log" })).toBeInViewport();
    await expect(steps.nth(2)).toHaveAttribute("data-done", "true", { timeout: 15_000 });
    await steps.nth(3).getByRole("button", { name: "Take me there" }).click();
    await expect(page.getByRole("region", { name: "Compliance" })).toBeInViewport();
    await expect(steps.nth(3)).toHaveAttribute("data-done", "true", { timeout: 15_000 });

    // e. Optional: done only when the Update is in the data, however it got there.
    await expect(steps.nth(4)).toContainText("Optional");
    await expect(steps.nth(4)).toHaveAttribute("data-done", "false");
    await steps.nth(4).getByRole("button", { name: "Take me there" }).click();
    await expect(page.getByRole("region", { name: /Message to the customer/ })).toBeInViewport();
    const emma = await db.user.findUniqueOrThrow({ where: { email: EMMA } });
    await db.issueCommunication.create({
      data: { issueId: iss1042.id, type: "UPDATE", occurredAt: new Date(), channel: "EMAIL", personName: "Silvia Moretti", message: "Update: the certificate is renewed and name checks are recovering.", recordedById: emma.id, recordedByName: emma.name },
    });
    await expect(steps.nth(4)).toHaveAttribute("data-done", "true", { timeout: 15_000 });

    // Done steps stay done after a reload (the viewed ones are remembered in the browser), and the panel keeps its place.
    await page.reload();
    const again = page.getByRole("complementary", { name: "Scenario 1" }).locator("[data-onboarding-step]");
    for (let i = 0; i < 5; i++) await expect(again.nth(i)).toHaveAttribute("data-done", "true", { timeout: 15_000 });
    await expect(page.getByRole("complementary", { name: "Scenario 1" }).getByRole("link", { name: "See how it was built" })).toHaveAttribute("href", START_HERE_URL);

    // Collapse and reopen.
    await page.getByRole("button", { name: "Collapse the scenario panel" }).click();
    await expect(page.getByRole("complementary", { name: "Scenario 1" })).toHaveCount(0);
    await page.getByRole("button", { name: /Scenario 1: 5 of 5 done/ }).click();
    await expect(page.getByRole("complementary", { name: "Scenario 1" })).toBeVisible();
  });
});

test.describe("scenario 2 and the Why this? notes", () => {
  let fx: LinkedIssueFixture;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(240_000);
    const context = await browser.newContext({ baseURL: "http://localhost:3104" });
    const page = await context.newPage();
    fx = await createLinkedIssueFixture(page, context.request);
    await context.close();
  });

  test("the checks follow the data, and Take me there switches the person for each step", async ({ page }) => {
    test.setTimeout(240_000);
    await signInAs(page, EMAIL.lukas);
    await page.goto("/");
    await page.getByRole("button", { name: WELCOME.scenario2 }).click();
    const panel = page.getByRole("complementary", { name: "Scenario 2" });
    const steps = panel.locator("[data-onboarding-step]");
    await expect(steps).toHaveCount(5);

    // The fixture reported the Lloyds issue and created the linked issues: already done when the panel opens.
    await expect(steps.nth(0)).toHaveAttribute("data-done", "true", { timeout: 15_000 });
    await expect(steps.nth(2)).toHaveAttribute("data-done", "true");
    for (const i of [1, 3, 4]) await expect(steps.nth(i)).toHaveAttribute("data-done", "false");

    // b. Acknowledge, then Set to Degraded, as Lukas.
    await steps.nth(1).getByRole("button", { name: "Take me there" }).click();
    await expect(page).toHaveURL(new RegExp(`/issues/${fx.parentId}$`));
    await expect.poll(() => viewingAs(page)).toContain("Lukas Brenner");
    await expect(page.getByRole("region", { name: "Affected customers" }).or(page.locator('[data-onboarding="affected-customers"]'))).toBeVisible();
    await page.getByRole("button", { name: "Acknowledge" }).click();
    await expect(page.getByText("Issue acknowledged")).toBeVisible();
    await expect(steps.nth(1)).toHaveAttribute("data-done", "false"); // acknowledged, not yet Degraded
    await page.getByRole("button", { name: "Set to Degraded" }).click();
    const coverage = page.getByRole("dialog", { name: /Change status/ });
    await coverage.getByRole("radio", { name: "Degraded" }).check();
    await coverage.getByRole("button", { name: "Save status" }).click();
    await expect(page.getByText("Coverage status saved")).toBeVisible();
    await expect(steps.nth(1)).toHaveAttribute("data-done", "true", { timeout: 15_000 });

    // c. Linked issues: Take me there lands on the partner issue.
    await steps.nth(2).getByRole("button", { name: "Take me there" }).click();
    await expect(page).toHaveURL(new RegExp(`/issues/${fx.parentId}$`));

    // d. Adrian Koh: Home, with "Notify Revolut Ltd"; record the notification.
    await steps.nth(3).getByRole("button", { name: "Take me there" }).click();
    await expect.poll(() => viewingAs(page)).toContain("Adrian Koh");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId(`line1-${fx.childId}`)).toHaveText("Notify Revolut Ltd", { timeout: 20_000 });
    await page.goto(`/issues/${fx.childId}`);
    await page.getByRole("region", { name: "Message to the customer" }).getByRole("button", { name: "Record notification" }).click();
    const dialog = page.getByRole("dialog", { name: "Record notification" });
    await dialog.getByRole("combobox", { name: "Channel" }).click();
    await page.getByRole("option", { name: "Email" }).click();
    await dialog.getByRole("button", { name: "Record notification" }).click();
    await expect(page.getByText("Notification recorded")).toBeVisible();
    await expect(steps.nth(3)).toHaveAttribute("data-done", "true", { timeout: 15_000 });

    // e. Lukas resolves once; every linked issue resolves with it.
    await steps.nth(4).getByRole("button", { name: "Take me there" }).click();
    await expect.poll(() => viewingAs(page)).toContain("Lukas Brenner");
    await expect(page).toHaveURL(new RegExp(`/issues/${fx.parentId}$`));
    await expect(steps.nth(4)).toHaveAttribute("data-done", "false");
    await signInAs(page, EMAIL.lukas);
    const { resolvePartnerWithCascade } = await import("./fixtures/role-actions-setup");
    await resolvePartnerWithCascade(page, fx, { alreadyAcknowledged: true });
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("complementary", { name: "Scenario 2" }).locator("[data-onboarding-step]").nth(4)).toHaveAttribute("data-done", "true", { timeout: 15_000 });
    const child = await db.issue.findUniqueOrThrow({ where: { id: fx.childId } });
    expect(child.status).toBe("RESOLVED");
  });

  test("five Why this? popovers render, each with two sentences", async ({ page }) => {
    await signInAs(page, EMAIL.lukas);
    const expected = (key: NoteKey) => NOTES[key].text;

    async function open(key: NoteKey, nth = 0) {
      await page.locator(`[data-onboarding-why="${key}"]`).nth(nth).click();
      const popover = page.locator(`[data-onboarding-popover="${key}"]`);
      await expect(popover).toBeVisible();
      await expect(popover).toContainText(expected(key));
      expect(NOTES[key].text.split(/(?<=\.)\s+/)).toHaveLength(2);
      return popover;
    }

    // The Home Time column.
    await page.goto("/");
    await expect(page.locator('[data-onboarding="time-column"]').first()).toBeVisible();
    await open("time-column");
    await page.keyboard.press("Escape");
    await expect(page.locator('[data-onboarding-popover="time-column"]')).toHaveCount(0);

    // The partner issue: Your next action, Action plan, People, Linked issues and Affected customers.
    await page.goto(`/issues/${fx.parentId}`);
    for (const key of ["next-action", "action-plan", "owner-communicator"] as const) {
      await open(key);
      await page.keyboard.press("Escape");
    }
    // Linked issues and Affected customers share one note: both icons open it.
    await expect(page.locator('[data-onboarding-why="linked-issues"]')).toHaveCount(2);
    await open("linked-issues", 0);
    await page.mouse.click(5, 300); // a click elsewhere closes it
    await expect(page.locator('[data-onboarding-popover="linked-issues"]')).toHaveCount(0);
    await open("linked-issues", 1);
  });
});

test.describe("mobile notice", () => {
  test("below 900 px a dismissible notice names the desktop and links the README; at 900 px and above it is hidden", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const notice = page.locator('[data-onboarding="mobile-notice"]');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText("Customer Hub is built for desktop. Open it on a laptop for the full demo.");
    await expect(notice.getByRole("link", { name: "Read the README" })).toHaveAttribute("href", START_HERE_URL);
    // The card and the panel are for desktop: nothing else crowds the small screen.
    await expect(page.getByRole("complementary", { name: "Welcome" })).toBeHidden();

    await page.setViewportSize({ width: 900, height: 800 });
    await expect(notice).toBeHidden();
    await page.setViewportSize({ width: 899, height: 800 });
    await expect(notice).toBeVisible();

    await notice.getByRole("button", { name: "Dismiss notice" }).click();
    await expect(notice).toHaveCount(0);
    await page.reload();
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator('[data-onboarding="mobile-notice"]')).toHaveCount(0);
  });
});
