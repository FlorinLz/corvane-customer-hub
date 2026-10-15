import "dotenv/config";

import { expect, test, type Page } from "@playwright/test";

import { db } from "@/server/db";
import { CONTINUE_LABEL, DECISIONS_URL, FINISH_LABEL, NOTES, SCENARIOS, START_HERE_URL, STORAGE_KEYS, WELCOME, chapterOf, type NoteKey } from "@/lib/onboarding/content";
import { REPORT_HINTS } from "@/components/onboarding/hints";

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
    // The prologue of chapter 1 is open the first time; it can be folded away and opened again.
    const prologue = panel.locator('[data-onboarding="prologue"]');
    for (const t of chapterOf("1a").prologue) await expect(prologue).toContainText(t);
    await prologue.getByRole("button", { name: "The morning after" }).click();
    await expect(prologue).not.toContainText(chapterOf("1a").prologue[0]);
    await prologue.getByRole("button", { name: "The morning after" }).click();
    await expect(prologue).toContainText(chapterOf("1a").prologue[0]);
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

    // e. Done only when the Update is in the data, however it got there. It is no longer optional.
    await expect(steps.nth(4)).not.toContainText("Optional");
    await expect(steps.nth(4)).toHaveAttribute("data-done", "false");
    await expect(panel.locator('[data-onboarding="chapter-end"]')).toHaveCount(0);
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
    // The end of chapter 1: its text and the two buttons.
    const end = page.locator('[data-onboarding="chapter-end"]');
    await expect(end).toContainText(chapterOf("1a").end.text);
    await expect(end.getByRole("button", { name: CONTINUE_LABEL })).toBeVisible();
    await expect(end.getByRole("button", { name: FINISH_LABEL })).toBeVisible();

    // Collapse and reopen.
    await page.getByRole("button", { name: "Collapse the scenario panel" }).click();
    await expect(page.getByRole("complementary", { name: "Scenario 1" })).toHaveCount(0);
    await page.getByRole("button", { name: /Scenario 1: 5 of 5 done/ }).click();
    await expect(page.getByRole("complementary", { name: "Scenario 1" })).toBeVisible();
    await page.getByRole("button", { name: FINISH_LABEL }).click();
    await expect(page.getByRole("complementary", { name: "Scenario 1" })).toHaveCount(0);
  });

  test("chapter 2 opens once the Update is done, and runs end to end through View as: resolve, confirm, share, approve, send", async ({ page }) => {
    test.setTimeout(240_000);
    await page.context().route("https://mail.google.com/**", (r) => r.fulfill({ body: "ok" }));
    const iss = await db.issue.findUniqueOrThrow({ where: { number: 1042 } });
    const emma = await db.user.findUniqueOrThrow({ where: { email: EMMA } });
    await page.goto("/");
    await startScenario(page, 1);
    const panel = page.getByRole("complementary", { name: "Scenario 1" });
    await expect(panel.getByRole("button", { name: "Go to chapter 2: Closing the loop" })).toHaveCount(0); // not before the Update
    await db.issueCommunication.create({
      data: { issueId: iss.id, type: "UPDATE", occurredAt: new Date(), channel: "EMAIL", personName: "Silvia Moretti", message: "Update: name checks are recovering.", recordedById: emma.id, recordedByName: emma.name },
    });
    await panel.getByRole("button", { name: "Go to chapter 2: Closing the loop" }).click();
    await expect(panel).toHaveAttribute("data-chapter", "1b");
    for (const t of chapterOf("1b").prologue) await expect(panel.locator('[data-onboarding="prologue"]')).toContainText(t);
    const step = (id: string) => panel.locator(`[data-onboarding-step="${id}"]`);
    const go = async (id: string, who: string) => {
      await step(id).getByRole("button", { name: "Take me there" }).click();
      await expect.poll(() => viewingAs(page)).toContain(who);
      await expect(page).toHaveURL(new RegExp(`/issues/${iss.id}$`));
      await expect(page.getByRole("region", { name: "Your next action" })).toBeVisible();
    };
    const done = (id: string) => expect(step(id)).toHaveAttribute("data-done", "true", { timeout: 20_000 });
    const hint = page.locator('[data-onboarding-hint="draft-link"]');

    // 1. Kevin resolves.
    await go("s1b-resolve", "Kevin Lim");
    await expect(step("s1b-resolve")).toHaveAttribute("data-done", "false");
    await page.getByRole("group", { name: "Issue actions" }).getByRole("button", { name: "Change status", exact: true }).click();
    const status = page.getByRole("dialog", { name: "Change status" });
    await status.getByRole("radio", { name: "Resolved" }).check();
    await status.getByLabel("Root cause").fill("The endpoint certificate expired after the rotation job failed.");
    await status.getByLabel("Solution").fill("Kevin renewed the certificate and fixed the rotation job.");
    await status.getByRole("button", { name: "Resolve issue" }).click();
    await expect(page.getByText("Issue resolved")).toBeVisible();
    await done("s1b-resolve");

    // 2. Emma confirms with Silvia.
    await go("s1b-confirm", "Emma Wilson");
    await expect(step("s1b-confirm")).toHaveAttribute("data-done", "false");
    await page.getByRole("region", { name: "Message to the customer" }).getByRole("button", { name: "Confirm resolution with the customer", exact: true }).click();
    const confirm = page.getByRole("dialog", { name: "Confirm resolution" });
    await confirm.getByRole("combobox", { name: "Channel" }).click();
    await page.getByRole("option", { name: "Email" }).click();
    await confirm.getByRole("button", { name: "Confirm resolution" }).click();
    await expect(page.getByText("Resolution confirmed", { exact: true })).toBeVisible();
    await done("s1b-confirm");

    // 3. Kevin shares the draft; the dialog shows an example link on the approved host, and only while this step is open.
    await go("s1b-share", "Kevin Lim");
    await expect(step("s1b-share")).toHaveAttribute("data-done", "false");
    await page.getByRole("region", { name: "Your next action" }).getByRole("button", { name: "Share draft" }).click();
    const share = page.getByRole("dialog", { name: "Share draft of the root cause report" });
    await expect(hint).toContainText("For example https://docs.corvane-internal.example/reports/");
    const link = ((await hint.innerText()).match(/https:\/\/\S+/) ?? [""])[0];
    // The one hint that fills a field: the link, and only the link.
    await expect(share.getByLabel("Draft link *")).toHaveValue("");
    await hint.getByRole("button", { name: "Use example link" }).click();
    await expect(share.getByLabel("Draft link *")).toHaveValue(link);
    await expect(share.getByLabel("Summary *")).toHaveValue("");
    await share.getByLabel("Summary *").fill("Cause: the certificate expired. Impact: every MPS name check failed. Fix: a renewed certificate and a repaired rotation job.");
    await share.getByRole("button", { name: "Share draft" }).click();
    await expect(page.getByText("Draft shared", { exact: true })).toBeVisible();
    await done("s1b-share");
    await expect(hint).toHaveCount(0);

    // 4. Mei approves.
    await go("s1b-approve", "Mei Chen");
    await expect(step("s1b-approve")).toHaveAttribute("data-done", "false");
    await page.getByRole("region", { name: "Your next action" }).getByRole("button", { name: "Approve report" }).click();
    await page.getByRole("dialog", { name: "Approve root cause report" }).getByRole("button", { name: "Approve report" }).click();
    await expect(page.getByText("Report approved", { exact: true })).toBeVisible();
    await done("s1b-approve");

    // 5. Kevin sends it: the last step, so ISS-1042 closes on its own.
    await go("s1b-send", "Kevin Lim");
    await expect(step("s1b-send")).toHaveAttribute("data-done", "false");
    await page.getByRole("region", { name: "Your next action" }).getByRole("button", { name: "Record report sent" }).click();
    const sent = page.getByRole("dialog", { name: "Record report sent" });
    await sent.getByRole("combobox", { name: "Channel" }).click();
    await page.getByRole("option", { name: "Email" }).click();
    await sent.getByRole("button", { name: "Record report sent" }).click();
    await done("s1b-send");
    expect((await db.issue.findUniqueOrThrow({ where: { id: iss.id } })).status).toBe("CLOSED");
    const end = panel.locator('[data-onboarding="chapter-end"]');
    await expect(end).toContainText(chapterOf("1b").end.text);
    await expect(end.getByRole("link", { name: "See how it was built" })).toHaveAttribute("href", START_HERE_URL);
    await expect(end.getByRole("button", { name: CONTINUE_LABEL })).toHaveCount(0);
    // "Nothing is left on anyone's Home": a closed issue is on nobody's list.
    await page.goto("/");
    await expect(page.locator("#worklist-issues")).toBeVisible();
    await expect(page.getByTestId(`issue-row-${iss.id}`)).toHaveCount(0);
  });

  test("Report issue hints show only while scenario 2's Report issue step is open, and never fill a field", async ({ page }) => {
    await signInAs(page, EMAIL.lukas);
    const hints = page.locator("[data-onboarding-hint]");
    const openDrawer = async () => {
      await page.getByRole("button", { name: "Report issue" }).click();
      return page.getByRole("dialog", { name: "Report issue" });
    };

    // No scenario open: no hints.
    await page.goto("/");
    await expect(page.getByRole("dialog", { name: WELCOME.step1.title })).toBeVisible();
    await page.keyboard.press("Escape"); // the welcome modal
    await expect(page.getByRole("dialog")).toHaveCount(0);
    let drawer = await openDrawer();
    await expect(drawer.getByRole("combobox", { name: "Affected entity *" })).toBeVisible();
    await expect(hints).toHaveCount(0);
    await page.keyboard.press("Escape");

    // Scenario 1 open: none either.
    await page.getByRole("button", { name: "About this demo" }).click();
    await startScenario(page, 1);
    drawer = await openDrawer();
    await expect(drawer.getByRole("combobox", { name: "Affected entity *" })).toBeVisible();
    await expect(hints).toHaveCount(0);
    await page.keyboard.press("Escape");

    // Scenario 2 open, nothing reported yet: a hint under each field that is listed, and the fields stay empty.
    await page.getByRole("button", { name: "Switch to scenario 2" }).click();
    drawer = await openDrawer();
    await expect(drawer.locator('[data-onboarding-hint="entity"]')).toHaveText(REPORT_HINTS.entity);
    await expect(drawer.getByRole("combobox", { name: "Affected entity *" })).toHaveValue("");
    await drawer.getByRole("combobox", { name: "Affected entity *" }).fill("Lloyds");
    await page.getByRole("option", { name: /Lloyds Bank plc/ }).first().click();
    await drawer.getByRole("combobox", { name: "Type" }).click();
    await page.getByRole("option", { name: "Partner degraded or unavailable" }).click();
    await expect(drawer.locator('[data-onboarding-hint="type"]')).toHaveText(REPORT_HINTS.type);
    await expect(drawer.locator('[data-onboarding-hint="coverage"]')).toHaveText(REPORT_HINTS.coverage);
    await expect(drawer.locator('[data-onboarding-hint="description"]')).toHaveText(REPORT_HINTS.description);
    await expect(drawer.locator('[data-onboarding-hint="aware"]')).toHaveText(REPORT_HINTS.aware);
    await expect(drawer.getByLabel("Description")).toHaveValue("");
    await expect(drawer.getByRole("radio", { name: /UK CoP \/ GB/ })).not.toBeChecked();
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
    await expect(steps).toHaveCount(6);
    // The prologue and the signal card from Paul Grant.
    const c2 = chapterOf("2");
    await expect(panel.locator('[data-onboarding="prologue"]')).toContainText(c2.prologue[0]);
    const signal = panel.locator('[data-onboarding="signal-card"]');
    await expect(signal).toContainText(c2.signal!.from);
    await expect(signal).toContainText(c2.signal!.subject);
    await expect(signal).toContainText(c2.signal!.body);
    await expect(signal).toContainText(c2.signal!.footnote);

    // The fixture reported the Lloyds issue and created the linked issues: already done when the panel opens.
    await expect(steps.nth(1)).toHaveAttribute("data-done", "true", { timeout: 15_000 });
    await expect(steps.nth(3)).toHaveAttribute("data-done", "true");
    for (const i of [0, 2, 4, 5]) await expect(steps.nth(i)).toHaveAttribute("data-done", "false");

    // 1. Who depends on Lloyds: as Lukas, the Lloyds Partner tab, done once its UK CoP coverage has been in view. The report is done, so no hints.
    await steps.nth(0).getByRole("button", { name: "Take me there" }).click();
    await expect.poll(() => viewingAs(page)).toContain("Lukas Brenner");
    const lloyds = await db.entity.findFirstOrThrow({ where: { legalName: "Lloyds Bank plc" } });
    await expect(page).toHaveURL(new RegExp(`/entities/${lloyds.id}/partner$`));
    const card = page.locator('[data-onboarding="partner-customers"]');
    await expect(card).toBeInViewport();
    await expect(steps.nth(0)).toHaveAttribute("data-done", "true", { timeout: 15_000 });
    // The card lists the customers on UK CoP / GB, the same ones Affected customers lists on the partner issue.
    const list = card.getByTestId("coverage-customers");
    await expect(list).toContainText(/Customers on this coverage \(\d+\)/);
    await expect(list.getByRole("link", { name: "Revolut Ltd" })).toHaveAttribute("href", /\/entities\/.+\/overview/);
    const listed = Number((await list.innerText()).match(/Customers on this coverage \((\d+)\)/)![1]);
    await page.goto(`/issues/${fx.parentId}`);
    await expect(page.locator('[data-onboarding="affected-customers"]')).toContainText(`Affected customers (${listed})`);
    await page.goBack();
    await expect(card).toBeAttached();
    await expect(steps.nth(0)).toHaveAttribute("data-done", "true", { timeout: 15_000 }); // remembered
    await page.goto("/");
    await page.getByRole("button", { name: "Report issue" }).click();
    await expect(page.getByRole("dialog", { name: "Report issue" }).getByRole("combobox", { name: "Affected entity *" })).toBeVisible();
    await expect(page.locator("[data-onboarding-hint]")).toHaveCount(0);
    await page.keyboard.press("Escape");

    // b. Acknowledge, then Set to Degraded, as Lukas.
    await steps.nth(2).getByRole("button", { name: "Take me there" }).click();
    await expect(page).toHaveURL(new RegExp(`/issues/${fx.parentId}$`));
    await expect.poll(() => viewingAs(page)).toContain("Lukas Brenner");
    await expect(page.getByRole("region", { name: "Affected customers" }).or(page.locator('[data-onboarding="affected-customers"]'))).toBeVisible();
    await page.getByRole("button", { name: "Acknowledge" }).click();
    await expect(page.getByText("Issue acknowledged")).toBeVisible();
    await expect(steps.nth(2)).toHaveAttribute("data-done", "false"); // acknowledged, not yet Degraded
    await page.getByRole("button", { name: "Set to Degraded" }).click();
    const coverage = page.getByRole("dialog", { name: /Change status/ });
    await coverage.getByRole("radio", { name: "Degraded" }).check();
    await coverage.getByRole("button", { name: "Save status" }).click();
    await expect(page.getByText("Coverage status saved")).toBeVisible();
    await expect(steps.nth(2)).toHaveAttribute("data-done", "true", { timeout: 15_000 });

    // c. Linked issues: Take me there lands on the partner issue.
    await steps.nth(3).getByRole("button", { name: "Take me there" }).click();
    await expect(page).toHaveURL(new RegExp(`/issues/${fx.parentId}$`));

    // d. Adrian Koh: Home, with "Notify Revolut Ltd"; record the notification.
    await steps.nth(4).getByRole("button", { name: "Take me there" }).click();
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
    await expect(steps.nth(4)).toHaveAttribute("data-done", "true", { timeout: 15_000 });

    // e. Lukas resolves once; every linked issue resolves with it.
    await steps.nth(5).getByRole("button", { name: "Take me there" }).click();
    await expect.poll(() => viewingAs(page)).toContain("Lukas Brenner");
    await expect(page).toHaveURL(new RegExp(`/issues/${fx.parentId}$`));
    await expect(steps.nth(5)).toHaveAttribute("data-done", "false");
    await signInAs(page, EMAIL.lukas);
    const { resolvePartnerWithCascade } = await import("./fixtures/role-actions-setup");
    await resolvePartnerWithCascade(page, fx, { alreadyAcknowledged: true });
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("complementary", { name: "Scenario 2" }).locator("[data-onboarding-step]").nth(5)).toHaveAttribute("data-done", "true", { timeout: 15_000 });
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
