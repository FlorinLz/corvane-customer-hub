import "dotenv/config";

import { expect, test, type Page } from "@playwright/test";

import { db } from "@/server/db";
import { DECISIONS_URL, NOTES, SCENARIOS, START_HERE_URL, STORAGE_KEYS, WELCOME, type NoteKey } from "@/lib/onboarding/content";

import { EMAIL, createLinkedIssueFixture, resetDemoData, signInAs, type LinkedIssueFixture } from "./fixtures/role-actions-setup";

/**
 * First-visit onboarding: the welcome modal, the scenario panel and its data checks, the "Why this?" notes, the mobile notice.
 * Runs on the role-actions project's production build (Mon 05 Oct 2026). Every test starts from an empty browser storage (the config
 * dismisses the card for the other specs), so each one is a first visit.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const EMMA = "emma.wilson@corvane.example";

async function viewingAs(page: Page): Promise<string> {
  return (await page.getByRole("combobox", { name: "View as" }).innerText()).trim();
}

/** Walks the welcome modal to its last step and opens a scenario from its card. */
async function startScenario(page: Page, id: 1 | 2) {
  const modal = page.getByRole("dialog", { name: WELCOME.step1.title });
  await modal.getByRole("button", { name: "Next" }).click();
  await page.getByRole("dialog", { name: WELCOME.step2.title }).getByRole("button", { name: "Next" }).click();
  await page.locator(`[data-onboarding="scenario-card-${id}"]`).click();
}

test.describe("welcome modal", () => {
  test("a first visit shows step 1; Next and Back walk three steps; the dots follow", async ({ page }) => {
    await page.goto("/");
    const modal = page.getByRole("dialog", { name: WELCOME.step1.title });
    await expect(modal).toBeVisible();
    expect((await modal.boundingBox())!.width).toBe(560);
    for (const p of WELCOME.step1.paragraphs) await expect(modal).toContainText(p);
    await expect(modal.getByRole("button", { name: "Back" })).toHaveCount(0);
    await expect(modal.locator('[data-dot="1"]')).toHaveAttribute("data-active", "true");

    await modal.getByRole("button", { name: "Next" }).click();
    const two = page.getByRole("dialog", { name: WELCOME.step2.title });
    for (const p of WELCOME.step2.paragraphs) await expect(two).toContainText(p);
    await expect(two.getByRole("listitem")).toHaveText([...WELCOME.step2.principles]);
    await expect(two.locator('[data-dot="2"]')).toHaveAttribute("data-active", "true");

    await two.getByRole("button", { name: "Next" }).click();
    const three = page.getByRole("dialog", { name: WELCOME.step3.title });
    await expect(three.getByRole("button", { name: "Next" })).toHaveCount(0);
    for (const id of [1, 2] as const) {
      const card = three.locator(`[data-onboarding="scenario-card-${id}"]`);
      await expect(card).toContainText(WELCOME.step3.cards[id].label);
      await expect(card).toContainText(WELCOME.step3.cards[id].title);
      await expect(card).toContainText(WELCOME.step3.cards[id].text);
    }
    await expect(three).toContainText(WELCOME.step3.note);
    await expect(three.getByRole("link", { name: WELCOME.howBuilt })).toHaveAttribute("href", START_HERE_URL);
    await expect(three.getByRole("link", { name: WELCOME.decisions })).toHaveAttribute("href", DECISIONS_URL);

    await three.getByRole("button", { name: "Back" }).click();
    await expect(page.getByRole("dialog", { name: WELCOME.step2.title })).toBeVisible();
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByRole("dialog", { name: WELCOME.step1.title })).toBeVisible();
  });

  test("Explore, X, Esc and a click outside close it; dismissal persists; the ? reopens at step 1", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("dialog", { name: WELCOME.step1.title })).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: WELCOME.step3.explore }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEYS.welcomeDismissed)).toBe("1");

    await page.reload();
    await expect(page.locator("#worklist-issues")).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // The ? reopens at step 1 (after the modal was left on step 3 before), and each way out works.
    for (const [way, close] of [
      ["X", () => page.getByRole("button", { name: "Close", exact: true }).click()],
      ["Esc", () => page.keyboard.press("Escape")],
      ["click outside", () => page.locator("div.fixed.inset-0.bg-black\\/40").click({ position: { x: 20, y: 400 } })],
    ] as const) {
      await page.getByRole("button", { name: "About this demo" }).click();
      await expect(page.getByRole("dialog", { name: WELCOME.step1.title })).toBeVisible();
      await close();
      await expect(page.getByRole("dialog"), way).toHaveCount(0);
    }
  });

  test("both scenario cards open their panel and close the modal", async ({ page }) => {
    await page.goto("/");
    await startScenario(page, 2);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("complementary", { name: "Scenario 2" })).toBeVisible();
    await page.getByRole("button", { name: "Close the scenario panel" }).click();
    await page.getByRole("button", { name: "About this demo" }).click();
    await startScenario(page, 1);
    await expect(page.getByRole("complementary", { name: "Scenario 1" })).toBeVisible();
  });

  test("with storage blocked the modal shows once per page load and can still be closed", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        get() {
          throw new DOMException("blocked", "SecurityError");
        },
      });
    });
    await page.goto("/");
    await expect(page.getByRole("dialog", { name: WELCOME.step1.title })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.goto("/");
    await expect(page.getByRole("dialog", { name: WELCOME.step1.title })).toBeVisible();
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
    await startScenario(page, 1);

    const panel = page.getByRole("complementary", { name: "Scenario 1" });
    await expect(panel).toBeVisible();
    expect((await panel.boundingBox())!.width).toBe(360);
    await expect(panel.getByRole("heading", { name: SCENARIOS[1].title })).toBeVisible();
    const steps = panel.locator("[data-onboarding-step]");
    await expect(steps).toHaveCount(5);
    for (let i = 0; i < 5; i++) await expect(steps.nth(i)).toHaveAttribute("data-done", "false");
    // The modal is gone once a scenario starts, and the page narrows to make room for the panel.
    await expect(page.getByRole("dialog")).toHaveCount(0);
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
    await context.addInitScript((k) => localStorage.setItem(k, "1"), STORAGE_KEYS.welcomeDismissed); // the modal would cover the page
    const page = await context.newPage();
    fx = await createLinkedIssueFixture(page, context.request);
    await context.close();
  });

  test("the checks follow the data, and Take me there switches the person for each step", async ({ page }) => {
    test.setTimeout(240_000);
    await signInAs(page, EMAIL.lukas);
    await page.goto("/");
    await startScenario(page, 2);
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

  test("five Why this? popovers render with the plain copy", async ({ page }) => {
    await page.addInitScript((k) => localStorage.setItem(k, "1"), STORAGE_KEYS.welcomeDismissed);
    await signInAs(page, EMAIL.lukas);
    const expected = (key: NoteKey) => NOTES[key].text;

    async function open(key: NoteKey, nth = 0) {
      await page.locator(`[data-onboarding-why="${key}"]`).nth(nth).click();
      const popover = page.locator(`[data-onboarding-popover="${key}"]`);
      await expect(popover).toBeVisible();
      await expect(popover).toContainText("Why this?");
      await expect(popover).toContainText(expected(key));
      await expect(popover).not.toContainText("principle");
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
    // The modal and the panel are for desktop: nothing else crowds the small screen.
    await expect(page.getByRole("dialog")).toHaveCount(0);

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
