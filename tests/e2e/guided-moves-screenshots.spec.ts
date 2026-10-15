import "dotenv/config";

import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { STORAGE_KEYS } from "@/lib/onboarding/content";

import { resetDemoData } from "./fixtures/role-actions-setup";

/**
 * Guided moves screenshots at 1440 px: scenario 2 step 1 move by move (search, result, Partner tab, list), Report issue with the bubble on
 * Description and Fill for me, a View as move, the off-path panel, and 1b step 1 inside the Resolve dialog. Runs only with SHOTS_DIR set.
 */
const DIR = process.env.SHOTS_DIR;

test.skip(!DIR, "SHOTS_DIR not set");
test.use({ storageState: { cookies: [], origins: [] } });

const bubble = (page: Page) => page.locator("[data-onboarding-bubble]");
const ring = (page: Page) => page.locator("[data-onboarding-highlight]");
const panel = (page: Page) => page.getByRole("complementary", { name: /^Scenario/ });

async function setPanel(page: Page, scenario: 1 | 2, chapter: string) {
  await page.addInitScript(
    ([welcome, mobile, panelKey, pref]) => {
      localStorage.setItem(welcome, "1");
      localStorage.setItem(mobile, "1");
      localStorage.setItem(panelKey, pref);
    },
    [STORAGE_KEYS.welcomeDismissed, STORAGE_KEYS.mobileDismissed, STORAGE_KEYS.panel, JSON.stringify({ scenario, chapter, collapsed: false, closedPrologues: [], openedPrologues: [] })],
  );
}

/** Clicks where the ring is (the target), as a visitor would. */
async function clickRing(page: Page) {
  await expect(ring(page)).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(800);
  const r = (await ring(page).boundingBox())!;
  await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
}

test("screenshots", async ({ page, request }) => {
  test.setTimeout(420_000);
  await resetDemoData(request);
  await page.setViewportSize({ width: 1440, height: 900 });
  const shot = async (name: string) => {
    await expect(bubble(page)).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(DIR!, name) });
  };
  const text = async () => (await bubble(page).locator('[data-onboarding="bubble-text"]').innerText()).trim();
  const until = async (needle: string) => {
    await expect.poll(async () => ((await bubble(page).count()) ? await text() : ""), { timeout: 25_000 }).toContain(needle);
  };

  // Scenario 2, step 1: View as, then search, the result, the Partner tab and the list.
  await setPanel(page, 2, "2");
  await page.goto("/");
  await until("Open View as");
  await shot("s2-1a-view-as-open.png"); // a View as move
  await clickRing(page);
  await until("Pick Network");
  await shot("s2-1b-view-as-pick.png");
  await clickRing(page);
  await until("Type Lloyds");
  await shot("s2-1c-search-type.png");
  await bubble(page).getByRole("button", { name: "Fill for me" }).click();
  await until("Press Enter");
  await shot("s2-1d-search-enter.png");
  await clickRing(page);
  await page.keyboard.press("Enter");
  await until("Click Lloyds Bank plc");
  await shot("s2-1e-search-result.png");
  await clickRing(page);
  await until("Partner tab");
  await shot("s2-1f-partner-tab.png");
  await clickRing(page);
  await until("These customers send checks");
  await shot("s2-1g-customers-list.png");
  await bubble(page).getByRole("button", { name: "Got it" }).click();

  // Report issue with the bubble on Description and Fill for me.
  await until("Click Home");
  await clickRing(page);
  await until("Click Report issue");
  await clickRing(page);
  await until("Type Lloyds");
  await bubble(page).getByRole("button", { name: "Fill for me" }).click();
  await until("Pick Lloyds Bank plc");
  await clickRing(page);
  await until("Partner degraded or unavailable");
  await clickRing(page);
  await until("Pick Partner degraded or unavailable");
  await clickRing(page);
  await until("Pick UK CoP / GB");
  await clickRing(page);
  await until("Summarise Paul");
  await shot("s2-2-report-description-bubble.png");
  await bubble(page).getByRole("button", { name: "Fill for me" }).click();
  await expect(page.getByLabel("Description *")).toHaveValue(/Lloyds reports CoP responses timing out/);
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(DIR!, "s2-2-report-description-filled.png") });

  // The off-path panel: leave the report form and wander to the search page.
  await page.keyboard.press("Escape");
  await page.goto("/search?q=Santander");
  await expect(panel(page).locator('[data-onboarding="off-path"]')).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(DIR!, "off-path-panel.png") });

  // 1b step 1 inside the Resolve dialog.
  const one = await page.context().newPage();
  await one.setViewportSize({ width: 1440, height: 900 });
  await setPanel(one, 1, "1b");
  await one.goto("/");
  const b1 = one.locator("[data-onboarding-bubble]");
  const r1 = one.locator("[data-onboarding-highlight]");
  const step = async (needle: string) => {
    await expect.poll(async () => ((await b1.count()) ? (await b1.locator('[data-onboarding="bubble-text"]').innerText()).trim() : ""), { timeout: 25_000 }).toContain(needle);
    await one.waitForTimeout(700);
  };
  const click = async () => {
    const r = (await r1.boundingBox())!;
    await one.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
  };
  await step("Open View as");
  await click();
  await step("Pick Ops");
  await click();
  await step("Click ISS-1042");
  await click();
  await step("Click Resolve");
  await click();
  await step("Write the root cause");
  await b1.getByRole("button", { name: "Fill for me" }).click();
  await step("Write the solution");
  await one.waitForTimeout(500);
  await one.screenshot({ path: path.join(DIR!, "1b-1-resolve-dialog-bubble.png") });
});
