import "dotenv/config";

import { expect, test, type Page } from "@playwright/test";

import { db } from "@/server/db";

import { createLinkedIssueFixture, EMAIL, signInAs, type LinkedIssueFixture } from "./fixtures/role-actions-setup";

/**
 * Role actions on issues. Runs only under the `role-actions`
 * Playwright project: a production build, demo clock Mon 05 Oct 2026, 10:48
 * CEST (playwright.config.ts), the Gmail window stubbed.
 *
 * Real seed users: Adrian Koh (Ops, MYT) owns Revolut Ltd and Lloyds Bank plc; Kevin Lim (Ops,
 * MYT) owns ISS-1038 on Revolut; Lukas Brenner (Network, SGT) reports and owns the partner
 * outage on Lloyds, whose linked Revolut issue has Adrian as its communicator.
 */

test.describe.configure({ mode: "serial" });

let fx: LinkedIssueFixture;

// The clock keeps running from 10:48 CEST while the build and the setup take their time: match shapes, not literals.
const TIME_LEFT = /^(Overdue( .+)?|Due now|(in )?\d+ min|(in )?\d+ h( \d+ min)?|(in )?\d+ days?)$/;

async function goHome(page: Page, email: string) {
  await signInAs(page, email);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /^Issues/ })).toBeVisible();
}

async function issueRowFor(page: Page, number: string) {
  return page.locator('[data-testid^="issue-row-"]', { hasText: number });
}

/** The issue ids of the Home Issues rows, top to bottom. */
async function rowOrder(page: Page) {
  const rows = page.locator('#worklist-issues [data-testid^="issue-row-"]');
  const n = await rows.count();
  const ids: string[] = [];
  for (let i = 0; i < n; i++) ids.push((await rows.nth(i).getAttribute("data-testid"))!.replace("issue-row-", ""));
  return ids;
}

test.beforeAll(async ({ browser }) => {
  test.setTimeout(240_000);
  const context = await browser.newContext({ baseURL: "http://localhost:3104" });
  const page = await context.newPage();
  fx = await createLinkedIssueFixture(page, context.request);
  await context.close();
});

test.beforeEach(async ({ context }) => {
  await context.route("https://mail.google.com/**", (r) => r.fulfill({ body: "ok" }));
});

test.describe("Home, scope Mine", () => {
  test("Adrian Koh: his own action first with his deadline, then the issue he waits on", async ({ page }) => {
    await goHome(page, EMAIL.adrian);
    await expect(page.getByTestId("issues-note")).toHaveText("Your actions first, then by deadline, then by severity");

    const child = page.getByTestId(`issue-row-${fx.childId}`);
    await expect(child.getByTestId(`line1-${fx.childId}`)).toHaveText("Notify Revolut Ltd");
    const tb = child.getByTestId(`time-block-${fx.childId}`);
    await expect(tb.locator("span").first()).toHaveText(TIME_LEFT);
    await expect(tb).toContainText(/by (\d\d:\d\d|\w{3} \d\d \w{3}, \d\d:\d\d) MYT/); // Adrian's own zone, label always shown
    await expect(child).toContainText("Linked to " + fx.parentDisplayId);
    await expect(child).toContainText("Sev-1");
    await expect(child).toContainText("UK CoP / GB");
    await expect(child.getByTestId(`line2-${fx.childId}`)).toContainText("Owner: Lukas Brenner");

    const waiting = await issueRowFor(page, "ISS-1038");
    await expect(waiting.locator('[data-testid^="line1-"]')).toHaveText(/^Waiting on Kevin Lim \(Owner\): Investigate$/);
    const wtb = waiting.locator('[data-testid^="time-block-"]');
    await expect(wtb).toContainText("No deadline");
    await expect(wtb).toContainText("for you");
    await expect(wtb).toHaveAttribute("data-state", "none");

    const order = await rowOrder(page);
    const iss1038 = await db.issue.findFirstOrThrow({ where: { number: 1038 } });
    expect(order.indexOf(fx.childId)).toBeGreaterThanOrEqual(0);
    expect(order.indexOf(fx.childId)).toBeLessThan(order.indexOf(iss1038.id));
  });

  test("Adrian Koh: the whole row is the link, reachable by keyboard", async ({ page }) => {
    await goHome(page, EMAIL.adrian);
    const child = page.getByTestId(`issue-row-${fx.childId}`);
    expect(await child.evaluate((el) => el.tagName)).toBe("A");
    await expect(child).not.toContainText("Open"); // no separate Open link on the row
    await expect(child.getByRole("link")).toHaveCount(0); // the row itself is the one link
    await child.focus();
    await expect(child).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/issues/${fx.childId}$`));
  });

  test("Kevin Lim: owner of ISS-1038 and ISS-1042 with 'Investigate' and no deadline; only waiting on the linked issue", async ({ page }) => {
    await goHome(page, EMAIL.kevin);
    for (const number of ["ISS-1038", "ISS-1042"]) {
      const row = await issueRowFor(page, number);
      await expect(row.locator('[data-testid^="line1-"]')).toHaveText("Investigate");
      await expect(row.locator('[data-testid^="time-block-"]')).toHaveAttribute("data-state", "none");
      await expect(row.locator('[data-testid^="time-block-"]')).toContainText("for you");
    }
    // On the linked issue he is only a default contributor: a Contributing row in the same shape, waiting on the others.
    const contributing = page.locator(`[data-testid="issue-row-${fx.childId}"]`);
    await expect(contributing.locator('[data-testid^="line1-"]')).toHaveText(/^Waiting on .+ \((Owner|Communicator|Compliance)\): /);
    await expect(contributing.locator('[data-testid^="time-block-"]')).toHaveAttribute("data-state", "none");
  });

  test("Lukas Brenner: acknowledge on the partner issue leads; his linked-issue action carries the partner issue's own deadline", async ({ page }) => {
    await goHome(page, EMAIL.lukas);
    const parent = page.getByTestId(`issue-row-${fx.parentId}`);
    await expect(parent.locator('[data-testid^="line1-"]')).toHaveText(`Acknowledge ${fx.parentDisplayId}`);
    await expect(parent.locator('[data-testid^="time-block-"] span').first()).toHaveText(TIME_LEFT);
    await expect(parent.locator('[data-testid^="time-block-"]')).toContainText(/ SGT/);

    const child = page.getByTestId(`issue-row-${fx.childId}`);
    await expect(child.locator('[data-testid^="line1-"]')).toHaveText(`Acknowledge on ${fx.parentDisplayId}`);
    // The linked issue's "Acknowledge on ISS-n" mirrors the partner issue's own acknowledge clock: the same deadline, in his zone.
    await expect(child.locator('[data-testid^="time-block-"]')).not.toHaveAttribute("data-state", "none");
    await expect(child.locator('[data-testid^="time-block-"] span').first()).toHaveText(TIME_LEFT);
    await expect(child.locator('[data-testid^="time-block-"]')).toContainText(/ SGT/);
    expect(await child.locator('[data-testid^="time-block-"]').innerText()).toBe(await parent.locator('[data-testid^="time-block-"]').innerText());

    // The seeded partner issues (ISS-1020 to ISS-1030) sit around them by their own deadlines: look at these two only.
    const order = (await rowOrder(page)).filter((id) => id === fx.parentId || id === fx.childId);
    expect(order).toEqual([fx.parentId, fx.childId]); // same deadline: the partner issue first
  });
});

test.describe("Home, scope My team", () => {
  test("Adrian Koh: the most urgent open action on each issue, with its person, sorted by that deadline", async ({ page }) => {
    await goHome(page, EMAIL.adrian);
    await page.getByRole("button", { name: "My team" }).click();
    await expect(page.getByTestId("issues-note")).toHaveText("Most urgent first, then by severity");
    const child = page.getByTestId(`issue-row-${fx.childId}`);
    // Whoever owns it: Lukas's "Acknowledge on ISS-n" carries the partner issue's 15 min clock, due before Mei Chen's 1 h assessment and Adrian Koh's 2 h notification.
    await expect(child.locator('[data-testid^="line1-"]')).toHaveText(/^Lukas Brenner: Acknowledge on ISS-\d{4}$/);
    // The time block names whose deadline it shows, in Adrian's zone.
    await expect(child.locator('[data-testid^="time-block-"]')).toContainText(/Lukas Brenner · by (\d\d:\d\d|\w{3} \d\d \w{3}, \d\d:\d\d) MYT/);
    await expect(child.getByTestId(`line2-${fx.childId}`)).toContainText("Compliance: Mei Chen, assess");
    await expect(child.getByTestId(`line2-${fx.childId}`)).toContainText("Communicator: Adrian Koh, notify Revolut Ltd");
    // No row appears twice (My team used to show one row per team member).
    const order = await rowOrder(page);
    expect(new Set(order).size).toBe(order.length);
    // Kevin's issues are there, led by his action.
    const kevinRow = await issueRowFor(page, "ISS-1038");
    await expect(kevinRow.locator('[data-testid^="line1-"]')).toHaveText("Kevin Lim: Investigate");
    await expect(kevinRow.locator('[data-testid^="time-block-"]')).toContainText("Kevin Lim");
  });
});

test.describe("Home table", () => {
  test("Adrian Koh: columns Issue, Time, Description, Customer, Next actions; the customer, the partner tag, the first line of the description without the 'Linked to' pointer", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goHome(page, EMAIL.adrian);
    const child = page.getByTestId(`issue-row-${fx.childId}`);
    for (const col of ["Issue", "Time", "Description", "Customer", "Next actions"]) await expect(page.getByText(col, { exact: true }).first()).toBeVisible();
    await expect(child.getByTestId(`customer-${fx.childId}`)).toHaveText("Revolut Ltd");
    await expect(child.getByTestId(`desc-${fx.childId}`)).toContainText("Partner degraded or unavailable");
    await expect(child.getByTestId(`desc-${fx.childId}`)).not.toContainText("Linked to ISS");
    await expect(child.getByTestId(`desc-${fx.childId}`)).toContainText("Lloyds Bank plc CoP responses time out");
    await expect(child.getByText("You", { exact: true })).toBeVisible(); // the "You" chip before his own action
    // The partner issue: the customer column tags it.
    const parent = page.getByTestId(`issue-row-${fx.parentId}`);
    await expect(parent.getByText("Partner", { exact: true }).filter({ visible: true })).toBeVisible();
    // Full text on hover.
    await expect(child.locator('[title*="Notify Revolut Ltd"]').first()).toBeAttached();
  });

  test("below 1100 px Description and Customer merge into one column; at 1100 px and above they are two", async ({ page }) => {
    await goHome(page, EMAIL.adrian);
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.getByText("Customer", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Description and customer").first()).toBeHidden();
    await page.setViewportSize({ width: 1024, height: 900 });
    await expect(page.getByText("Description and customer").first()).toBeVisible();
    await expect(page.getByText("Customer", { exact: true }).first()).toBeHidden();
  });

  test("the Issues chip has the table header's number and names Contributing next to it; Contributing is its own card with its own count", async ({ page }) => {
    await goHome(page, EMAIL.adrian);
    const issues = Number((await page.getByRole("heading", { name: /^Issues \(\d+\)$/ }).innerText()).match(/\((\d+)\)/)![1]);
    const contributing = Number((await page.getByRole("heading", { name: /^Contributing \(\d+\)$/ }).innerText()).match(/\((\d+)\)/)![1]);
    await expect(page.getByRole("link", { name: new RegExp(contributing > 0 ? `^Issues ${issues} · Contributing ${contributing}$` : `^Issues ${issues}$`) })).toBeVisible();
  });
});

test.describe('Home: "Your worklist is clear"', () => {
  test("not shown to Lukas Brenner while Issues and Contributing have rows; shown to Nora Lee, who has nothing anywhere", async ({ page }) => {
    await goHome(page, EMAIL.lukas);
    await expect(page.getByRole("heading", { name: /^Issues \(\d+\)$/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Contributing \(\d+\)$/ })).toBeVisible();
    await expect(page.getByText("Your worklist is clear")).toHaveCount(0);

    await signInAs(page, "nora.lee@corvane.example");
    await page.goto("/");
    await expect(page.getByText("Your worklist is clear")).toBeVisible();
    await expect(page.getByText("No issues for you. Report one from the entity record.")).toBeVisible();
  });
});

test.describe("Issue page v5, linked issue", () => {
  test("Adrian Koh (communicator): header, no Issue actions, Your next action with the one primary button, the Action plan", async ({ page }) => {
    await signInAs(page, EMAIL.adrian);
    await page.goto(`/issues/${fx.childId}`);

    await expect(page.getByTestId("header-owner")).toHaveText(/Owner:\s*Lukas Brenner\s*\(Network\)/);
    await expect(page.getByRole("group", { name: "Issue actions" })).toHaveCount(0); // owner only
    await expect(page.getByRole("button", { name: "More actions" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Clocks" })).toHaveCount(0);
    await expect(page.getByText(/Overdue by/)).toHaveCount(0);

    // Issue description without the "Linked to" pointer; About and Timeline.
    await expect(page.getByTestId("issue-description")).not.toContainText("Linked to ISS");
    await expect(page.getByRole("region", { name: "About this issue" })).toContainText("Revolut Ltd");
    await expect(page.getByRole("region", { name: "About this issue" })).toContainText(fx.parentDisplayId);
    const timeline = page.getByRole("region", { name: "Timeline" });
    await expect(timeline).toContainText(`Times from ${fx.parentDisplayId}`);
    await expect(timeline.getByTestId("timeline-aware")).toHaveText(/^\w{3} \d\d \w{3}, \d\d:\d\d MYTSource: Email$/);
    await expect(timeline.getByTestId("timeline-opened")).toHaveText(/MYT$/);

    // Your next action.
    const next = page.getByRole("region", { name: "Your next action" });
    await expect(next.getByTestId("next-action-title")).toHaveText("Notify Revolut Ltd of the partner outage");
    await expect(next.getByTestId("next-action-sub")).toHaveText(/^Your role on ISS-\d{4}: Communicator$/);
    await expect(next.getByTestId("next-action-time").locator("span").first()).toHaveText(TIME_LEFT);
    await expect(next.getByRole("button", { name: "Go to the message" })).toBeVisible(); // the filled primary is the Message panel's own Record notification

    // Action plan: his row first, the others, then the steps waiting on an earlier one.
    const plan = page.getByRole("region", { name: "Action plan" });
    await expect(plan).toContainText("Times in your zone, MYT");
    const mine = plan.getByTestId("plan-row-notify");
    await expect(mine).toHaveAttribute("data-me", "true");
    await expect(mine).toContainText("Adrian Koh");
    await expect(mine).toContainText("You");
    await expect(mine).toContainText("Required by the customer contract: notify the customer within 2 h");
    await expect(mine.getByTestId("plan-time-notify").locator("span").first()).toHaveText(TIME_LEFT);
    await expect(mine.getByTestId("plan-time-notify")).toContainText(/by (\d\d:\d\d|\w{3} \d\d \w{3}, \d\d:\d\d) MYT/);
    await expect(plan.getByRole("button")).toHaveCount(0); // the table has no buttons: the one primary button is in Your next action

    const owner = plan.getByTestId("plan-row-acknowledge_on_parent");
    await expect(owner).toContainText("Lukas Brenner");
    await expect(owner).not.toContainText("You");
    for (const key of ["investigate", "prepare_report", "review_report", "send_report", "close"]) {
      const row = plan.getByTestId(`plan-row-${key}`);
      await expect(row, key).toHaveAttribute("data-state", "blocked");
      await expect(row, key).toContainText("Waiting");
    }
    await expect(plan.getByTestId("plan-row-prepare_report")).toContainText("Required by the customer contract: 14 days after resolution");
    await expect(plan.getByTestId("plan-row-send_report")).toContainText("Send approved report to Revolut Ltd");
    await expect(plan.getByTestId("plan-row-close")).toContainText(`Starts when ${fx.parentDisplayId} is resolved`);
    await expect(plan.getByTestId("plan-row-close")).toHaveAttribute("data-me", "true"); // his waiting step keeps the "You" marker
    // Order: the waiting steps are last.
    const states = await plan.locator('[data-testid^="plan-row-"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-state")));
    expect(states.lastIndexOf("open")).toBeLessThan(states.indexOf("blocked"));
  });

  test("Adrian Koh: the one filled primary of a message step is the Message panel's Record notification; Your next action has a secondary button that scrolls to it", async ({ page }) => {
    await signInAs(page, EMAIL.adrian);
    await page.goto(`/issues/${fx.childId}`);
    const rowButton = page.getByRole("region", { name: "Your next action" }).getByRole("button", { name: "Go to the message" });
    const panelButton = page.getByRole("region", { name: "Message to the customer" }).getByRole("button", { name: "Record notification" });
    const isPrimary = async (loc: ReturnType<Page["locator"]>) => (await loc.evaluate((el) => el.className)).includes("bg-primary");

    expect(await isPrimary(panelButton)).toBe(true);
    expect(await isPrimary(rowButton)).toBe(false);
    await expect(page.getByRole("region", { name: "Your next action" }).getByRole("button", { name: "Record notification" })).toHaveCount(0);

    await rowButton.click();
    await expect(panelButton).toBeInViewport();
    expect(await isPrimary(panelButton)).toBe(true); // nothing swaps: it was the primary all along
    await panelButton.click();
    await expect(page.getByRole("dialog", { name: "Record notification" })).toBeVisible();
  });

  test("Lukas Brenner (owner, SGT): Issue actions without Reassign owner on a linked issue; no notification button; times in SGT", async ({ page }) => {
    await signInAs(page, EMAIL.lukas);
    await page.goto(`/issues/${fx.childId}`);

    await expect(page.getByTestId("header-owner")).toContainText("Lukas Brenner");
    const bar = page.getByRole("group", { name: "Issue actions" });
    for (const name of ["Change status", "Change severity", "Change type", "Add contributor"]) await expect(bar.getByRole("button", { name, exact: true })).toBeVisible();
    await expect(bar.getByRole("button", { name: "Reassign owner" })).toHaveCount(0); // a linked issue follows its partner issue's owner

    const plan = page.getByRole("region", { name: "Action plan" });
    await expect(plan).toContainText("Times in your zone, SGT");
    await expect(plan.getByTestId("plan-row-notify")).toContainText("Adrian Koh");
    await expect(plan.getByTestId("plan-time-notify")).toContainText(/by (\d\d:\d\d|\w{3} \d\d \w{3}, \d\d:\d\d) SGT/);
    await expect(page.getByRole("region", { name: "Your next action" }).getByRole("button", { name: "Record notification" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Message to the customer" }).getByRole("button", { name: "Record notification" })).toHaveCount(0);

    const next = page.getByRole("region", { name: "Your next action" });
    await expect(next.getByRole("link", { name: `Acknowledge on ${fx.parentDisplayId}` })).toBeVisible();
    await expect(plan.getByTestId("plan-row-acknowledge_on_parent")).toHaveAttribute("data-me", "true");
  });

  test("Lukas Brenner on the partner issue: the five Issue actions open the existing dialogs; no More actions menu", async ({ page }) => {
    await signInAs(page, EMAIL.lukas);
    await page.goto(`/issues/${fx.parentId}`);
    await expect(page.getByRole("button", { name: "More actions" })).toHaveCount(0);
    const bar = page.getByRole("group", { name: "Issue actions" });
    for (const name of ["Change status", "Change severity", "Change type", "Reassign owner", "Add contributor"]) await expect(bar.getByRole("button", { name, exact: true })).toBeVisible();
    // The partner issue's communicator closes with the partner, not a customer (a customer issue keeps "Confirm resolution with the customer").
    const close = page.getByRole("region", { name: "Action plan" }).getByTestId("plan-row-close");
    await expect(close).toContainText("Confirm resolution with the partner");
    await expect(close).toContainText(`Starts when ${fx.parentDisplayId} is resolved`);
    await expect(page.getByRole("region", { name: "Action plan" }).getByTestId("plan-row-close")).not.toContainText("customer");
    await bar.getByRole("button", { name: "Change severity", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Change severity" })).toBeVisible();
    await page.keyboard.press("Escape");
    await bar.getByRole("button", { name: "Add contributor", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Add contributor" })).toBeVisible();
  });

  test("once the partner issue is acknowledged: the Done line, and Lukas's next action is to open the partner issue", async ({ page }) => {
    await signInAs(page, EMAIL.lukas);
    await page.goto(`/issues/${fx.parentId}`);
    await page.getByRole("region", { name: "Your next action" }).getByRole("button", { name: "Acknowledge" }).click();
    await expect(page.getByText("Issue acknowledged")).toBeVisible();

    await page.goto(`/issues/${fx.childId}`);
    const plan = page.getByRole("region", { name: "Action plan" });
    await expect(plan.getByTestId("plan-done")).toContainText(new RegExp(`Done: Acknowledged via ${fx.parentDisplayId} by Lukas Brenner at \\w{3} \\d\\d \\w{3}, \\d\\d:\\d\\d SGT, \\d+ min after Corvane became aware \\(target 15 min, on time\\)`));
    const investigate = plan.getByTestId("plan-row-investigate");
    await expect(investigate).toContainText(`Investigate with Lloyds Bank plc and resolve on ${fx.parentDisplayId}`);
    await expect(investigate).toHaveAttribute("data-state", "open");
    await expect(investigate.getByTestId("plan-time-investigate")).toContainText("No deadline");
    const next = page.getByRole("region", { name: "Your next action" });
    await expect(next.getByRole("link", { name: `Open ${fx.parentDisplayId}` })).toBeVisible();
    await expect(page.getByRole("region", { name: "Timeline" }).getByTestId("timeline-acknowledged")).toContainText(`Via ${fx.parentDisplayId} by Lukas Brenner`);
  });
});
