import "dotenv/config";

import { expect, test, type Page } from "@playwright/test";

import { DECISIONS_URL, NOTES, START_HERE_URL, STORAGE_KEYS, WELCOME, type NoteKey } from "@/lib/onboarding/content";

import { EMAIL, createLinkedIssueFixture, signInAs, type LinkedIssueFixture } from "./fixtures/role-actions-setup";

/**
 * First-visit onboarding: the welcome modal, the scenario panel and its data checks, the "Why this?" notes, the mobile notice.
 * Runs on the role-actions project's production build (Mon 05 Oct 2026). Every test starts from an empty browser storage (the config
 * dismisses the card for the other specs), so each one is a first visit.
 */
test.use({ storageState: { cookies: [], origins: [] } });

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
