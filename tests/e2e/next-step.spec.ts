import "dotenv/config";

import { expect, test, type Locator, type Page } from "@playwright/test";

import { db } from "@/server/db";
import { STORAGE_KEYS, chapterOf, splitBold } from "@/lib/onboarding/content";

import { EMAIL, resetDemoData, signInAs } from "./fixtures/role-actions-setup";

/**
 * The next step, always clear: the open step with its Do this lines, the highlight on the page, and Take me there switching the person.
 * Runs on the role-actions project's production build (Mon 05 Oct 2026). Each test starts a scenario from the stored panel preference.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const EMMA = "emma.wilson@corvane.example";

async function open(page: Page, scenario: 1 | 2, chapter: "1a" | "1b" | "2") {
  await page.addInitScript(
    ([welcome, mobile, panelKey, pref]) => {
      localStorage.setItem(welcome, "1");
      localStorage.setItem(mobile, "1");
      if (!localStorage.getItem(panelKey)) localStorage.setItem(panelKey, pref);
    },
    [STORAGE_KEYS.welcomeDismissed, STORAGE_KEYS.mobileDismissed, STORAGE_KEYS.panel, JSON.stringify({ scenario, chapter, collapsed: false, closedPrologues: [], openedPrologues: [] })],
  );
}

const panelOf = (page: Page) => page.getByRole("complementary", { name: /^Scenario/ });
const stepOf = (page: Page, id: string) => panelOf(page).locator(`[data-onboarding-step="${id}"]`);
const viewing = (page: Page) => page.getByRole("combobox", { name: "View as" }).innerText().then((t) => t.trim());
const highlight = (page: Page) => page.locator("[data-onboarding-highlight]");

/** The highlight is on `raw` and sits over `target` (its 3 px of padding included). */
async function expectHighlightOn(page: Page, raw: string, target: Locator) {
  const hl = highlight(page);
  await expect(hl).toHaveAttribute("data-onboarding-highlight", raw, { timeout: 20_000 });
  await target.scrollIntoViewIfNeeded();
  await expect
    .poll(
      async () => {
        const [h, t] = [await hl.boundingBox(), await target.boundingBox()];
        return h && t ? Math.max(Math.abs(h.x - (t.x - 3)), Math.abs(h.y - (t.y - 3)), Math.abs(h.width - (t.width + 6)), Math.abs(h.height - (t.height + 6))) : 999;
      },
      { timeout: 10_000 },
    )
    .toBeLessThan(5);
}

/** The step is the open one: its Do this lines are there, with their labels in bold, and its Take me there is the way in. */
async function expectCurrent(page: Page, id: string, doThis: string[]) {
  const step = stepOf(page, id);
  await expect(step).toHaveAttribute("data-state", "current");
  const lines = step.locator('[data-onboarding="do-this"] li');
  await expect(lines).toHaveCount(doThis.length);
  for (let i = 0; i < doThis.length; i++) {
    await expect(lines.nth(i)).toHaveText(doThis[i].replace(/\*\*/g, ""));
    for (const part of splitBold(doThis[i]).filter((p) => p.bold)) await expect(lines.nth(i).locator("strong", { hasText: part.text }).first()).toBeVisible();
  }
}

async function takeMeThere(page: Page, id: string, who: string) {
  await stepOf(page, id).getByRole("button", { name: "Take me there" }).click();
  await expect.poll(() => viewing(page)).toContain(who);
}

const step = (chapter: "1a" | "1b" | "2", id: string) => chapterOf(chapter).steps.find((s) => s.id === id)!;

test.describe("chapter 1a", () => {
  test.beforeEach(async ({ request }) => {
    test.setTimeout(240_000);
    await resetDemoData(request);
  });

  test("each step: Take me there lands as Emma on the right page, the highlight is on the right element, a click removes it, the next step opens", async ({ page }) => {
    const iss = await db.issue.findUniqueOrThrow({ where: { number: 1042 } });
    const emma = await db.user.findUniqueOrThrow({ where: { email: EMMA } });
    await open(page, 1, "1a");
    await page.goto("/");
    const panel = panelOf(page);
    await expect(panel).toBeVisible();

    // Only the first step is open; the others are titles with Waiting.
    await expect(stepOf(page, "s1-home")).toHaveAttribute("data-state", "current");
    for (const id of ["s1-issue", "s1-log", "s1-compliance", "s1-update"]) {
      await expect(stepOf(page, id)).toHaveAttribute("data-state", "later");
      await expect(stepOf(page, id)).toContainText("Waiting");
      await expect(stepOf(page, id).getByRole("button", { name: "Take me there" })).toHaveCount(0);
    }
    // Reading ahead: a click opens a later step, read only and without any highlight.
    await stepOf(page, "s1-log").getByRole("button", { name: /Read the Communication log/ }).click();
    await expect(stepOf(page, "s1-log")).toContainText(step("1a", "s1-log").text);
    await expect(stepOf(page, "s1-log").getByRole("button", { name: "Take me there" })).toHaveCount(0);
    await expect(highlight(page)).toHaveCount(0);
    await stepOf(page, "s1-log").getByRole("button", { name: /Read the Communication log/ }).click();

    // 1. Home as Emma: the highlight is on the ISS-1042 row; a click on it opens the issue and the highlight goes.
    await expectCurrent(page, "s1-home", step("1a", "s1-home").doThis);
    await takeMeThere(page, "s1-home", "Emma Wilson");
    await expect(page).toHaveURL(/\/$/);
    const row = page.locator('[data-onboarding="issue-row"]', { hasText: "ISS-1042" });
    await expectHighlightOn(page, "issue-row~ISS-1042", row);
    await expect(highlight(page)).toContainText("Read this");
    await row.click();
    await expect(page).toHaveURL(new RegExp(`/issues/${iss.id}$`));
    await expect(highlight(page)).toHaveCount(0);
    // Not on the target's page any more: no highlight, and Take me there is still the way back.
    await takeMeThere(page, "s1-home", "Emma Wilson");
    await expect(page).toHaveURL(/\/$/);
    await expect(stepOf(page, "s1-home")).toHaveAttribute("data-state", "done", { timeout: 20_000 });
    await expect(stepOf(page, "s1-issue")).toHaveAttribute("data-state", "current");

    // 2-4. The viewed steps: highlight on the section, a click inside removes it, then it is read and the next step opens.
    const viewed = [
      ["s1-issue", "action-plan", "Action plan"],
      ["s1-log", "communication-log", "Communication log"],
      ["s1-compliance", "customer-obligations", "Customer obligations"],
    ] as const;
    for (const [id, name] of viewed) {
      await expectCurrent(page, id, step("1a", id).doThis);
      await takeMeThere(page, id, "Emma Wilson");
      await expect(page).toHaveURL(new RegExp(`/issues/${iss.id}$`));
      const target = page.locator(`[data-onboarding="${name}"]`).first();
      await expectHighlightOn(page, name, target);
      await target.click({ position: { x: 4, y: 4 } });
      await expect(highlight(page)).toHaveCount(0);
      await takeMeThere(page, id, "Emma Wilson"); // the highlight comes back
      await expectHighlightOn(page, name, target);
      await expect(stepOf(page, id)).toHaveAttribute("data-state", "done", { timeout: 20_000 });
      await expect(highlight(page).filter({ has: page.locator("xpath=self::*[@data-onboarding-highlight='" + name + "']") })).toHaveCount(0); // the next step has its own
    }

    // 5. The Update: the highlight goes to Record update, then into the dialog to its submit button.
    await expectCurrent(page, "s1-update", step("1a", "s1-update").doThis);
    await takeMeThere(page, "s1-update", "Emma Wilson");
    const record = page.locator('[data-onboarding="record-communication"]');
    await expectHighlightOn(page, "record-communication", record);
    await expect(highlight(page)).toContainText("Click here");
    await expect(record).toHaveText("Record update"); // the target keeps its own name
    await record.click();
    await expect(highlight(page)).toHaveCount(1);
    const submit = page.getByRole("dialog", { name: "Record notification" }).locator('[data-onboarding="record-communication-submit"]');
    await expectHighlightOn(page, "record-communication-submit", submit);
    await page.getByRole("dialog", { name: "Record notification" }).getByRole("combobox", { name: "Channel" }).click();
    await page.getByRole("option", { name: "Email" }).click();
    await submit.click();
    await expect(highlight(page)).toHaveCount(0);
    await expect(stepOf(page, "s1-update")).toHaveAttribute("data-state", "done", { timeout: 20_000 });
    const comm = await db.issueCommunication.findFirst({ where: { issueId: iss.id, type: "UPDATE", recordedById: emma.id } });
    expect(comm).not.toBeNull();
  });
});

test.describe("chapter 1b", () => {
  test.beforeEach(async ({ request }) => {
    test.setTimeout(300_000);
    await resetDemoData(request);
  });

  test("each step switches the person, highlights the button, and moves into the dialog; the next step opens by itself", async ({ page }) => {
    await page.context().route("https://mail.google.com/**", (r) => r.fulfill({ body: "ok" }));
    const iss = await db.issue.findUniqueOrThrow({ where: { number: 1042 } });
    const emma = await db.user.findUniqueOrThrow({ where: { email: EMMA } });
    await db.issueCommunication.create({
      data: { issueId: iss.id, type: "UPDATE", occurredAt: new Date(), channel: "EMAIL", personName: "Silvia Moretti", message: "Update: name checks are recovering.", recordedById: emma.id, recordedByName: emma.name },
    });
    await open(page, 1, "1b");
    await page.goto("/");
    const nextAction = page.locator('[data-onboarding="next-action"]');

    // 1. Kevin resolves.
    await expectCurrent(page, "s1b-resolve", step("1b", "s1b-resolve").doThis);
    await takeMeThere(page, "s1b-resolve", "Kevin Lim");
    await expect(page.getByText("You are now Kevin Lim (Ops)")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/issues/${iss.id}$`));
    const resolve = nextAction.locator('[data-onboarding="resolve"]');
    await expectHighlightOn(page, "next-action/resolve", resolve);
    await expect(resolve).toHaveText("Resolve");
    await resolve.click();
    const status = page.getByRole("dialog", { name: "Change status" });
    const resolveSubmit = status.locator('[data-onboarding="resolve-submit"]');
    await expectHighlightOn(page, "resolve-submit", resolveSubmit);
    await status.getByLabel("Root cause").fill("The endpoint certificate expired after the rotation job failed.");
    await status.getByLabel("Solution").fill("Kevin renewed the certificate and fixed the rotation job.");
    await resolveSubmit.click();
    await expect(highlight(page)).toHaveCount(0);
    await expect(stepOf(page, "s1b-resolve")).toHaveAttribute("data-state", "done", { timeout: 20_000 });
    await expect(stepOf(page, "s1b-confirm")).toHaveAttribute("data-state", "current"); // opened by itself

    // 2. Emma confirms: the real button is in the message panel, and the next action says Go to the message.
    await expectCurrent(page, "s1b-confirm", step("1b", "s1b-confirm").doThis);
    await takeMeThere(page, "s1b-confirm", "Emma Wilson");
    await expect(nextAction.getByRole("button", { name: "Go to the message" })).toBeVisible();
    const confirm = page.locator('[data-onboarding="confirm-resolution"]');
    await expectHighlightOn(page, "confirm-resolution", confirm);
    await confirm.click();
    const confirmDialog = page.getByRole("dialog", { name: "Confirm resolution" });
    const confirmSubmit = confirmDialog.locator('[data-onboarding="confirm-resolution-submit"]');
    await expectHighlightOn(page, "confirm-resolution-submit", confirmSubmit);
    await confirmDialog.getByRole("combobox", { name: "Channel" }).click();
    await page.getByRole("option", { name: "Email" }).click();
    await confirmSubmit.click();
    await expect(stepOf(page, "s1b-confirm")).toHaveAttribute("data-state", "done", { timeout: 20_000 });

    // 3. Kevin shares the draft: Share draft, then Use example link, then Share draft in the dialog.
    await expectCurrent(page, "s1b-share", step("1b", "s1b-share").doThis);
    await takeMeThere(page, "s1b-share", "Kevin Lim");
    const share = nextAction.locator('[data-onboarding="share-draft"]');
    await expectHighlightOn(page, "next-action/share-draft", share);
    await share.click();
    const shareDialog = page.getByRole("dialog", { name: "Share draft of the root cause report" });
    const useExample = shareDialog.locator('[data-onboarding="use-example-link"]');
    await expectHighlightOn(page, "use-example-link", useExample);
    await useExample.click();
    const shareSubmit = shareDialog.locator('[data-onboarding="share-draft-submit"]');
    await expectHighlightOn(page, "share-draft-submit", shareSubmit);
    await shareDialog.getByLabel("Summary *").fill("Cause: the certificate expired. Impact: every MPS name check failed. Fix: a renewed certificate and a repaired rotation job.");
    await shareSubmit.click();
    await expect(stepOf(page, "s1b-share")).toHaveAttribute("data-state", "done", { timeout: 20_000 });

    // 4. Mei approves.
    await expectCurrent(page, "s1b-approve", step("1b", "s1b-approve").doThis);
    await takeMeThere(page, "s1b-approve", "Mei Chen");
    const approve = nextAction.locator('[data-onboarding="approve-report"]');
    await expectHighlightOn(page, "next-action/approve-report", approve);
    await expect(approve).toHaveText("Approve report");
    await approve.click();
    const approveSubmit = page.getByRole("dialog", { name: "Approve root cause report" }).locator('[data-onboarding="approve-report-submit"]');
    await expectHighlightOn(page, "approve-report-submit", approveSubmit);
    await approveSubmit.click();
    await expect(stepOf(page, "s1b-approve")).toHaveAttribute("data-state", "done", { timeout: 20_000 });

    // 5. Kevin sends it.
    await expectCurrent(page, "s1b-send", step("1b", "s1b-send").doThis);
    await takeMeThere(page, "s1b-send", "Kevin Lim");
    const sent = nextAction.locator('[data-onboarding="record-report-sent"]');
    await expectHighlightOn(page, "next-action/record-report-sent", sent);
    await expect(sent).toHaveText("Record report sent");
    await sent.click();
    const sentDialog = page.getByRole("dialog", { name: "Record report sent" });
    const sentSubmit = sentDialog.locator('[data-onboarding="record-report-sent-submit"]');
    await expectHighlightOn(page, "record-report-sent-submit", sentSubmit);
    await sentDialog.getByRole("combobox", { name: "Channel" }).click();
    await page.getByRole("option", { name: "Email" }).click();
    await sentSubmit.click();
    await expect(stepOf(page, "s1b-send")).toHaveAttribute("data-state", "done", { timeout: 20_000 });
    await expect(highlight(page)).toHaveCount(0);
    expect((await db.issue.findUniqueOrThrow({ where: { id: iss.id } })).status).toBe("CLOSED");
  });

  test("viewing as somebody else on the step's page: the line says whose step it is, and its button switches", async ({ page }) => {
    const iss = await db.issue.findUniqueOrThrow({ where: { number: 1042 } });
    const emma = await db.user.findUniqueOrThrow({ where: { email: EMMA } });
    await db.issueCommunication.create({
      data: { issueId: iss.id, type: "UPDATE", occurredAt: new Date(), channel: "EMAIL", personName: "Silvia Moretti", message: "Update: name checks are recovering.", recordedById: emma.id, recordedByName: emma.name },
    });
    await open(page, 1, "1b");
    await signInAs(page, EMAIL.adrian);
    await page.goto(`/issues/${iss.id}`);
    const line = page.locator('[data-onboarding="wrong-person"]');
    await expect(line).toHaveText(/You are viewing as Adrian Koh\. This step is Kevin Lim.s\.\s*Switch to Kevin Lim/);
    await expect(highlight(page)).toHaveCount(0); // not the right person: nothing to click yet
    // Elsewhere, the line does not show.
    await page.goto("/");
    await expect(line).toHaveCount(0);
    await page.goto(`/issues/${iss.id}`);
    await line.getByRole("button", { name: "Switch to Kevin Lim" }).click();
    await expect(page.getByText("You are now Kevin Lim (Ops)")).toBeVisible();
    await expect.poll(() => viewing(page)).toContain("Kevin Lim");
    await expect(line).toHaveCount(0);
    await expectHighlightOn(page, "next-action/resolve", page.locator('[data-onboarding="next-action"] [data-onboarding="resolve"]'));
  });

  test("the ring pulses, and does not pulse when the visitor asks for less motion", async ({ page }) => {
    const iss = await db.issue.findUniqueOrThrow({ where: { number: 1042 } });
    const emma = await db.user.findUniqueOrThrow({ where: { email: EMMA } });
    await db.issueCommunication.create({
      data: { issueId: iss.id, type: "UPDATE", occurredAt: new Date(), channel: "EMAIL", personName: "Silvia Moretti", message: "Update: name checks are recovering.", recordedById: emma.id, recordedByName: emma.name },
    });
    await open(page, 1, "1b");
    await signInAs(page, EMAIL.kevin);

    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(`/issues/${iss.id}`);
    await expect(highlight(page)).toBeVisible({ timeout: 20_000 });
    expect(await highlight(page).evaluate((el) => getComputedStyle(el).animationName)).toBe("ch-highlight-pulse");
    // The tag is decoration; the button keeps its own name.
    await expect(highlight(page).locator("span")).toHaveAttribute("aria-hidden", "true");
    await expect(page.locator('[data-onboarding="next-action"]').getByRole("button", { name: "Resolve" })).toBeVisible();

    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect.poll(() => highlight(page).evaluate((el) => getComputedStyle(el).animationName)).toBe("none");

    // Esc takes the highlight away.
    await page.keyboard.press("Escape");
    await expect(highlight(page)).toHaveCount(0);
  });
});

test.describe("scenario 2", () => {
  test.beforeEach(async ({ request }) => {
    test.setTimeout(360_000);
    await resetDemoData(request);
  });

  test("each step: the right person, the right element, a click moves the highlight on, and the next step opens", async ({ page }) => {
    const lloyds = await db.entity.findFirstOrThrow({ where: { legalName: "Lloyds Bank plc" } });
    await open(page, 2, "2");
    await page.goto("/");
    const clickFlow = chapterOf("2");
    const doThis = (id: string) => clickFlow.steps.find((s) => s.id === id)!.doThis;

    // 1. Who depends on Lloyds: as Lukas, on the Partner tab.
    await expectCurrent(page, "s2-impact", doThis("s2-impact"));
    await takeMeThere(page, "s2-impact", "Lukas Brenner");
    await expect(page).toHaveURL(new RegExp(`/entities/${lloyds.id}/partner$`));
    const card = page.locator('[data-onboarding="partner-customers"]');
    await expectHighlightOn(page, "partner-customers", card);
    await expect(highlight(page)).toContainText("Read this");
    await card.click({ position: { x: 4, y: 4 } });
    await expect(highlight(page)).toHaveCount(0);
    await takeMeThere(page, "s2-impact", "Lukas Brenner");
    await expect(stepOf(page, "s2-impact")).toHaveAttribute("data-state", "done", { timeout: 20_000 });

    // 2. Report the issue: Report issue on Home, then the submit button in the drawer.
    await expectCurrent(page, "s2-report", doThis("s2-report"));
    await takeMeThere(page, "s2-report", "Lukas Brenner");
    await expect(page).toHaveURL(/\/$/);
    const report = page.locator('[data-onboarding="report-issue"]');
    await expectHighlightOn(page, "report-issue", report);
    await report.click();
    const drawer = page.getByRole("dialog", { name: "Report issue" });
    const reportSubmit = drawer.locator('[data-onboarding="report-issue-submit"]');
    await expectHighlightOn(page, "report-issue-submit", reportSubmit);
    await drawer.getByRole("combobox", { name: "Affected entity *" }).fill("Lloyds");
    await page.getByRole("option", { name: /Lloyds Bank plc/ }).first().click();
    await drawer.getByRole("combobox", { name: "Type" }).click();
    await page.getByRole("option", { name: "Partner degraded or unavailable" }).click();
    await drawer.getByRole("radio", { name: /UK CoP \/ GB/ }).check();
    await drawer.getByLabel("Description").fill("Lloyds Bank plc CoP responses time out. Revolut Ltd payee checks on UK CoP GB return no result.");
    await drawer.getByRole("combobox", { name: "Reported at the customer by" }).click();
    await page.getByRole("option", { name: "Found by Corvane" }).click();
    await drawer.getByRole("radio", { name: "Down" }).check();
    await drawer.getByRole("radio", { name: "No" }).check();
    await reportSubmit.click();
    await expect(page).toHaveURL(/\/issues\/.+\?reported=1/);
    const parentId = page.url().match(/\/issues\/([^/?]+)/)![1];
    await expect(stepOf(page, "s2-report")).toHaveAttribute("data-state", "done", { timeout: 20_000 });

    // 3. Acknowledge first, then Set to Degraded, then Save status.
    await expectCurrent(page, "s2-degraded", doThis("s2-degraded"));
    await takeMeThere(page, "s2-degraded", "Lukas Brenner");
    await expect(page).toHaveURL(new RegExp(`/issues/${parentId}(\\?.*)?$`));
    const ack = page.locator('[data-onboarding="next-action"] [data-onboarding="acknowledge"]');
    await expectHighlightOn(page, "next-action/acknowledge", ack);
    await expect(ack).toHaveText("Acknowledge");
    await ack.click();
    await expect(page.getByText("Issue acknowledged")).toBeVisible();
    const degraded = page.locator('[data-onboarding="set-degraded"]');
    await expectHighlightOn(page, "set-degraded", degraded); // the next thing, once Acknowledge is gone
    await degraded.click();
    const coverage = page.getByRole("dialog", { name: /Change status/ });
    const save = coverage.locator('[data-onboarding="save-coverage-status"]');
    await expectHighlightOn(page, "save-coverage-status", save);
    await save.click();
    await expect(stepOf(page, "s2-degraded")).toHaveAttribute("data-state", "done", { timeout: 20_000 });

    // 4. Create linked issues, then Create in the dialog.
    await expectCurrent(page, "s2-linked", doThis("s2-linked"));
    await takeMeThere(page, "s2-linked", "Lukas Brenner");
    const create = page.locator('[data-onboarding="create-linked-issues"]');
    await expectHighlightOn(page, "create-linked-issues", create);
    await create.click();
    const createDialog = page.getByRole("dialog", { name: "Create linked issues" });
    const createSubmit = createDialog.locator('[data-onboarding="create-linked-submit"]');
    await expectHighlightOn(page, "create-linked-submit", createSubmit);
    await createSubmit.click();
    await expect(stepOf(page, "s2-linked")).toHaveAttribute("data-state", "done", { timeout: 20_000 });

    // 5. Adrian: the Notify Revolut Ltd row on Home, then Record notification on the issue, then the dialog.
    await expectCurrent(page, "s2-notify", doThis("s2-notify"));
    await takeMeThere(page, "s2-notify", "Adrian Koh");
    await expect(page).toHaveURL(/\/$/);
    const notifyRow = page.locator('[data-onboarding="issue-row"]', { hasText: "Notify Revolut Ltd" });
    await expectHighlightOn(page, "issue-row~Notify Revolut Ltd", notifyRow);
    await notifyRow.click();
    await expect(page).toHaveURL(/\/issues\//);
    const recordNotification = page.locator('[data-onboarding="record-communication"]');
    await expectHighlightOn(page, "record-communication", recordNotification); // the step goes on across pages
    await expect(recordNotification).toHaveText("Record notification");
    await recordNotification.click();
    const notifyDialog = page.getByRole("dialog", { name: "Record notification" });
    const notifySubmit = notifyDialog.locator('[data-onboarding="record-communication-submit"]');
    await expectHighlightOn(page, "record-communication-submit", notifySubmit);
    await notifyDialog.getByRole("combobox", { name: "Channel" }).click();
    await page.getByRole("option", { name: "Email" }).click();
    await notifySubmit.click();
    await expect(stepOf(page, "s2-notify")).toHaveAttribute("data-state", "done", { timeout: 20_000 });

    // 6. Lukas resolves once: Resolve, the form, then Resolve in the cascade dialog.
    await expectCurrent(page, "s2-resolve", doThis("s2-resolve"));
    await takeMeThere(page, "s2-resolve", "Lukas Brenner");
    await expect(page).toHaveURL(new RegExp(`/issues/${parentId}(\\?.*)?$`));
    const resolve = page.locator('[data-onboarding="next-action"] [data-onboarding="resolve"]');
    await expectHighlightOn(page, "next-action/resolve", resolve);
    await resolve.click();
    const statusDialog = page.getByRole("dialog", { name: "Change status" });
    await expectHighlightOn(page, "resolve-submit", statusDialog.locator('[data-onboarding="resolve-submit"]'));
    await statusDialog.getByLabel("Root cause").fill("Lloyds CoP gateway overloaded after a configuration change on their side.");
    await statusDialog.getByLabel("Solution").fill("Lloyds rolled back the change; response times are back under one second.");
    const parent = await db.issue.findUniqueOrThrow({ where: { id: parentId } });
    const event = new Date(parent.awareAt.getTime() - 60 * 60_000);
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(event);
    const get = (t: string) => parts.find((p) => p.type === t)!.value;
    await statusDialog.getByTestId("resolve-event-date").fill(`${get("year")}-${get("month")}-${get("day")}`);
    await statusDialog.getByTestId("resolve-event-time").fill(`${get("hour")}:${get("minute")}`);
    await statusDialog.locator('[data-onboarding="resolve-submit"]').click();
    const cascade = page.getByRole("dialog", { name: "Resolve with linked issues" });
    const cascadeSubmit = cascade.locator('[data-onboarding="resolve-cascade-submit"]');
    await expectHighlightOn(page, "resolve-cascade-submit", cascadeSubmit);
    await cascadeSubmit.click();
    await expect(stepOf(page, "s2-resolve")).toHaveAttribute("data-state", "done", { timeout: 20_000 });
    await expect(highlight(page)).toHaveCount(0);
  });
});
