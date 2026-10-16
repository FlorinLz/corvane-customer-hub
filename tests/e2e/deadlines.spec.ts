import { expect, test, type Page } from "@playwright/test";

import { adminPool, as, issueId, newVisitor, wipeSandboxes, type Visitor } from "./fixtures/sandbox-visitor";

/**
 * The deadline model on the sandbox project (Mon 05 Oct 2026, 10:05 CEST, every visitor with their own copy of the data): what Home shows each
 * persona, how an Update moves the next one, and Waiting on customer pausing Restore. The database is the local Docker one.
 */
test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: 1440, height: 900 } });

const EMMA = "emma.wilson@corvane.example";
const KEVIN = "kevin.lim@corvane.example";
const LUKAS = "lukas.brenner@corvane.example";
const ADRIAN = "adrian.koh@corvane.example";
const MEI = "mei.chen@corvane.example";

const admin = adminPool();

test.beforeAll(async () => {
  await wipeSandboxes(admin);
});

test.afterAll(async () => {
  await new Promise((r) => setTimeout(r, 3000)); // a background refill may still be building a spare
  await wipeSandboxes(admin);
  await admin.end();
});

const timeBlocks = (page: Page) => page.locator('[data-testid^="time-block-"]');

async function homeStates(page: Page): Promise<string[]> {
  await page.goto("/");
  await expect(page.locator("#worklist-issues")).toBeVisible();
  await expect(timeBlocks(page).first()).toBeVisible();
  return timeBlocks(page).evaluateAll((els) => els.map((e) => e.getAttribute("data-state") ?? ""));
}

test("at 10:05 every scenario persona's Home shows a live deadline, and no persona has more than two red rows", async ({ browser }) => {
  const v = await newVisitor(browser);
  for (const email of [EMMA, KEVIN, LUKAS, ADRIAN, MEI]) {
    await as(v.context, email);
    const states = await homeStates(v.page);
    const live = states.filter((s) => ["over", "soon", "default", "paused"].includes(s));
    expect(live.length, `${email}: ${states.join(",")}`).toBeGreaterThan(0);
    expect(states.filter((s) => s === "over").length, `${email}: red rows`).toBeLessThanOrEqual(2);
  }
  await v.context.close();
});

test("Emma's Home: ISS-1042 is hers, the next update is due in under an hour (orange), and the other rows show whose clock it is", async ({ browser }) => {
  const v = await newVisitor(browser);
  await as(v.context, EMMA);
  await v.page.goto("/");
  const row = v.page.getByTestId(`time-block-${issueId(1042)}`);
  await expect(row).toBeVisible();
  await expect(row).toHaveAttribute("data-state", "soon");
  await expect(row).toContainText(/\d+ min/);
  // Somebody else's deadline reads "Rachel Wong", then the time left, then the clock's name; red only when breached.
  const others = v.page.locator('[data-testid^="time-block-"][data-own="false"]');
  expect(await others.count()).toBeGreaterThan(0);
  const first = others.first();
  await expect(first.locator("span").first()).toHaveText(/\w+ \w+/);
  await v.context.close();
});

async function sendUpdate(v: Visitor) {
  await as(v.context, EMMA);
  await v.page.goto(`/issues/${issueId(1042)}`);
  await expect(v.page.getByTestId("next-update-due")).toBeVisible();
  await v.page.getByRole("button", { name: "Record update" }).click();
  const dialog = v.page.getByRole("dialog", { name: "Record notification" });
  await dialog.getByRole("combobox", { name: "Channel" }).click();
  await v.page.getByRole("option", { name: "Email" }).click();
  await dialog.getByRole("button", { name: "Record notification" }).click();
  await expect(v.page.getByText("Update recorded")).toBeVisible();
  await v.page.goto("/");
  return v.page.getByTestId(`time-block-${issueId(1042)}`);
}

test("Emma sends an Update on ISS-1042: the service is restored, so her next update is 4 h ahead", async ({ browser }) => {
  const v = await newVisitor(browser);
  const cell = await sendUpdate(v);
  await expect(cell).toBeVisible();
  await expect(cell).toContainText(/(3 h 5\d min|4 h)/);
  const due = await v.page.goto(`/issues/${issueId(1042)}`).then(() => v.page.getByTestId("next-update-due").innerText());
  expect(due).toMatch(/Next update due by/);
  await v.context.close();
});

test("without the restore the same Update restarts a 60 minute clock", async ({ browser }) => {
  const v = await newVisitor(browser);
  await admin.query(`UPDATE "${v.schema}"."Issue" SET "restoredAt" = NULL, "restoredById" = NULL, "restoreNote" = NULL WHERE "number" = 1042`);
  const cell = await sendUpdate(v);
  await expect(cell).toContainText(/(5\d min|1 h)/);
  await v.context.close();
});

test("Waiting on customer pauses Restore, and resuming keeps the paused minutes", async ({ browser }) => {
  test.setTimeout(180_000);
  const v = await newVisitor(browser);
  await as(v.context, ADRIAN);
  const changeStatus = async (to: "Waiting on customer" | "In progress") => {
    await v.page.getByRole("group", { name: "Issue actions" }).getByRole("button", { name: "Change status", exact: true }).click();
    const dialog = v.page.getByRole("dialog", { name: "Change status" });
    await dialog.getByRole("radio", { name: to }).check();
    await dialog.getByRole("button", { name: "Change status" }).click();
    await expect(v.page.getByText("Status changed")).toBeVisible();
  };
  const restoreTime = () => v.page.getByTestId("plan-time-restore");

  await v.page.goto(`/issues/${issueId(1025)}`);
  await expect(restoreTime()).toBeVisible();
  await expect(restoreTime()).not.toHaveAttribute("data-state", "paused");
  const before = await restoreTime().innerText();

  await changeStatus("Waiting on customer");
  await expect(restoreTime()).toHaveAttribute("data-state", "paused");
  await expect(restoreTime()).toContainText("Paused");
  await expect(v.page.getByTestId("plan-time-investigate")).toHaveAttribute("data-state", "paused"); // Resolve is held too
  const row = (await admin.query(`SELECT "waitingOnCustomerSince" FROM "${v.schema}"."Issue" WHERE "number" = 1025`)).rows[0];
  expect(row.waitingOnCustomerSince).not.toBeNull();

  // The customer took three hours (inside the owner's business hours): move the start of the pause back.
  await admin.query(`UPDATE "${v.schema}"."Issue" SET "waitingOnCustomerSince" = "waitingOnCustomerSince" - interval '3 hours' WHERE "number" = 1025`);
  await changeStatus("In progress");
  await expect(restoreTime()).not.toHaveAttribute("data-state", "paused");
  const after = (await admin.query(`SELECT "pausedMinutes", "pausedBusinessMinutes", "waitingOnCustomerSince" FROM "${v.schema}"."Issue" WHERE "number" = 1025`)).rows[0];
  expect(after.waitingOnCustomerSince).toBeNull();
  expect(after.pausedBusinessMinutes).toBeGreaterThanOrEqual(175);
  expect(after.pausedBusinessMinutes).toBeLessThanOrEqual(195);
  expect(after.pausedMinutes).toBeGreaterThanOrEqual(175);
  // The deadline moved out by the paused time: the same clock reads later than it did before the pause.
  expect(await restoreTime().innerText()).not.toBe(before);
  await v.context.close();
});
