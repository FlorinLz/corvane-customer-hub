import "dotenv/config";

import { expect, test, type Page } from "@playwright/test";

import { db } from "@/server/db";
import { createAdminDb } from "@/server/db-admin";

import { createLinkedIssueFixture, EMAIL, signInAs } from "./fixtures/role-actions-setup";

/**
 * Issue page sections: the Communication log and Internal notes cards, the Incident contact block and About
 * this issue. Runs only under the `role-actions` Playwright project: a production build, demo clock Mon 05 Oct 2026, 10:48 CEST.
 */

test.describe.configure({ mode: "serial" });

const EMMA = "emma.wilson@corvane.example";

test.beforeAll(async ({ browser }) => {
  test.setTimeout(240_000);
  const context = await browser.newContext({ baseURL: "http://localhost:3104" });
  const page = await context.newPage();
  await createLinkedIssueFixture(page, context.request); // resets the demo data and leaves the partner issue ISS-1043 with its linked issues
  await context.close();
});

test.beforeEach(async ({ context }) => {
  await context.route("https://mail.google.com/**", (r) => r.fulfill({ body: "ok" }));
});

async function issueByNumber(n: number) {
  return db.issue.findFirstOrThrow({ where: { number: n } });
}

test.describe("Linked issues show the partner issue's deadlines", () => {
  test("before the partner acknowledgement: 'Acknowledge on ISS-n' has the partner issue's deadline, sorted with the others, for Mei Chen and Adrian Koh; after it, the Done line", async ({ page }) => {
    const parent = await db.issue.findFirstOrThrow({ where: { communicatorRule: "ISSUE_OWNER_PARTNER", number: { gt: 1042 } } });
    const child = await db.issue.findFirstOrThrow({ where: { routingRule: "INHERITED_FROM_PARENT", entity: { legalName: "Revolut Ltd" } } });
    
    for (const email of [EMAIL.mei, EMAIL.adrian]) {
      await signInAs(page, email);
      await page.goto(`/issues/${child.id}`);
      const plan = page.getByRole("region", { name: "Action plan" });
      const ack = plan.getByTestId("plan-row-acknowledge_on_parent");
      await expect(ack).toContainText("Acknowledge on ISS-");
      await expect(ack).toContainText("Lukas Brenner");
      await expect(ack.getByTestId("plan-time-acknowledge_on_parent")).not.toContainText("No deadline");
      await expect(ack.getByTestId("plan-time-acknowledge_on_parent")).toContainText(/by \d\d:\d\d SGT|by \w{3} \d\d \w{3}, \d\d:\d\d (MYT|SGT)|by \d\d:\d\d MYT/);
      // Sorted by deadline with the other open steps that have one, not parked among the steps without.
      const rows = await plan.locator('[data-testid^="plan-row-"][data-state="open"]').evaluateAll((els) => els.map((e) => ({ key: e.getAttribute("data-testid")!, none: (e.querySelector('[data-testid^="plan-time-"]') as HTMLElement | null)?.dataset.state === "none" })));
      const firstNoDeadline = rows.findIndex((r) => r.none);
      const ackIndex = rows.findIndex((r) => r.key === "plan-row-acknowledge_on_parent");
      expect(ackIndex).toBeGreaterThanOrEqual(0);
      if (firstNoDeadline >= 0) expect(ackIndex).toBeLessThan(firstNoDeadline);
    }
    // The partner issue's owner acknowledges; the linked issue then shows the Done line.
    await signInAs(page, EMAIL.lukas);
    await page.goto(`/issues/${parent.id}`);
    await page.getByRole("button", { name: "Acknowledge" }).click();
    await expect(page.getByText("Issue acknowledged")).toBeVisible();
    await signInAs(page, EMAIL.mei);
    await page.goto(`/issues/${child.id}`);
    await expect(page.getByRole("region", { name: "Action plan" }).getByTestId("plan-row-acknowledge_on_parent")).toHaveCount(0);
    await expect(page.getByTestId("plan-done")).toContainText(/Done: Acknowledged via ISS-\d{4} by Lukas Brenner at \w{3} \d\d \w{3}, \d\d:\d\d SGT/);
  });
});

test.describe("Internal notes", () => {
  test("a card of its own: 'Add note' opens an inline field with Save and Cancel; Cancel drops the text; Save adds the note first, with author, team and date time zone", async ({ page }) => {
    const iss = await issueByNumber(1038);
    await signInAs(page, EMMA);
    await page.goto(`/issues/${iss.id}`);
    const card = page.getByRole("region", { name: "Internal notes" });
    await expect(card.getByRole("heading", { name: "Internal notes. Never sent to the customer" })).toBeVisible();
    await expect(card.getByTestId("note-composer")).toHaveCount(0); // no always-open textarea any more
    await expect(card.getByTestId("note-row").first()).toContainText("Lukas Brenner · Network · "); // the seeded note, by a person

    // Open, type, cancel: nothing is saved, and the next time it opens it is empty.
    await card.getByRole("button", { name: "Add note" }).click();
    const field = card.getByPlaceholder("New internal note");
    await expect(card.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
    await field.fill("A note that is never saved.");
    await card.getByRole("button", { name: "Cancel" }).click();
    await expect(card.getByTestId("note-composer")).toHaveCount(0);
    expect(await db.issueNote.count({ where: { issueId: iss.id, body: "A note that is never saved." } })).toBe(0);
    await card.getByRole("button", { name: "Add note" }).click();
    await expect(card.getByPlaceholder("New internal note")).toHaveValue("");

    // Open, type, save.
    await card.getByPlaceholder("New internal note").fill("Customer asked for a call back after 14:00 CEST.");
    await card.getByRole("button", { name: "Save", exact: true }).click();
    await expect(card.getByTestId("note-composer")).toHaveCount(0);
    const first = card.getByTestId("note-row").first(); // newest first
    await expect(first).toContainText("Customer asked for a call back after 14:00 CEST.");
    await expect(first).toContainText(/^\s*Emma Wilson · Customer Success · \w{3} \d\d \w{3}, \d\d:\d\d CEST/);
    const saved = await db.issueNote.findFirstOrThrow({ where: { issueId: iss.id, body: "Customer asked for a call back after 14:00 CEST." } });
    expect(saved.kind).toBe("NOTE");
  });

  test("only notes written by people: the hand-over and communicator-change entries are system entries of the Communication log, not notes", async ({ page }) => {
    const iss = await issueByNumber(1042);
    await signInAs(page, EMMA);
    await page.goto(`/issues/${iss.id}`);
    await expect(page.getByRole("region", { name: "Internal notes" })).not.toContainText("handed over");
    const systemRow = page.getByRole("region", { name: "Communication log" }).locator('[data-testid="comm-log-entry"][data-type="SYSTEM"]').first();
    await expect(systemRow).toContainText("Customer Hub");
    await expect(systemRow).toContainText(/Communication handed over to Emma Wilson/);
    expect(await db.issueNote.count({ where: { issueId: iss.id, kind: "SYSTEM" } })).toBeGreaterThan(0); // still stored, shown in History only
  });

  test("empty state: 'No notes yet. Notes are internal and visible to all teams.'", async ({ page }) => {
    const iss = await issueByNumber(1031);
    const admin = createAdminDb(); // notes and communications are append-only for the app role: the setup uses the owner
    try {
      await admin.issueNote.deleteMany({ where: { issueId: iss.id } });
    } finally {
      await admin.$disconnect();
    }
    await signInAs(page, EMMA);
    await page.goto(`/issues/${iss.id}`);
    await expect(page.getByRole("region", { name: "Internal notes" })).toContainText("No notes yet. Notes are internal and visible to all teams.");
  });
});

test.describe("Communication log", () => {
  test("a card of its own, one tinted row per entry: type in bold, then date time zone · channel · contact · Recorded by; long messages Show more / Show less", async ({ page }) => {
    const iss = await issueByNumber(1038);
    const kevin = await db.user.findFirstOrThrow({ where: { name: "Kevin Lim" } });
    await db.issueCommunication.create({
      data: {
        issueId: iss.id, type: "UPDATE", occurredAt: new Date(), channel: "EMAIL", personName: "Priya Nair", recordedById: kevin.id, recordedByName: "Kevin Lim",
        message: ["Dear Priya Nair,", "Line two of the update.", "Line three of the update.", "Line four of the update.", "Line five of the update."].join("\n"), createdAt: new Date(),
      },
    });
    await signInAs(page, EMAIL.kevin);
    await page.goto(`/issues/${iss.id}`);
    const card = page.getByRole("region", { name: "Communication log" });
    await expect(card.getByRole("heading", { name: "Communication log. Messages exchanged with the customer" })).toBeVisible();
    const entries = card.getByTestId("comm-log-entry");
    const first = entries.filter({ hasText: "First notification" });
    await expect(first).toContainText(/First notification\s*\w{3} \d\d \w{3}, \d\d:\d\d MYT · Email · Priya Nair · Recorded by Kevin Lim/);
    await expect(first.getByRole("button", { name: /Show/ })).toHaveCount(0); // a short message

    const update = entries.filter({ hasText: "Line two of the update." }).or(entries.filter({ hasText: "Update" })).first();
    await expect(update).toContainText("Dear Priya Nair,");
    await expect(update).not.toContainText("Line five of the update.");
    await update.getByRole("button", { name: "Show more" }).click();
    await expect(update).toContainText("Line five of the update.");
    await update.getByRole("button", { name: "Show less" }).click();
    await expect(update).not.toContainText("Line five of the update.");
  });

  test("empty state: 'No communication recorded yet'", async ({ page }) => {
    const iss = await issueByNumber(1031);
    const admin = createAdminDb();
    try {
      await admin.issueCommunication.deleteMany({ where: { issueId: iss.id } });
    } finally {
      await admin.$disconnect();
    }
    await signInAs(page, EMMA);
    await page.goto(`/issues/${iss.id}`);
    await expect(page.getByRole("region", { name: "Communication log" })).toContainText("No communication recorded yet");
  });
});

test("1024 px: the two cards and the contact block are full width of their column, with no horizontal scroll", async ({ page }) => {
  const iss = await issueByNumber(1042);
  await signInAs(page, EMMA);
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto(`/issues/${iss.id}`);
  for (const name of ["Communication log", "Internal notes", "Incident contact", "Message to the customer"]) await expect(page.getByRole("region", { name })).toBeVisible();
  const widths = await Promise.all(["Communication log", "Internal notes", "Message to the customer"].map(async (n) => Math.round((await page.getByRole("region", { name: n }).boundingBox())!.width)));
  expect(new Set(widths).size).toBe(1); // the same width as the Message to the customer card
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test.describe("Links to the company page", () => {
  const overview = (id: string) => `/entities/${id}/overview`;

  test("a partner issue: 'Partner: Lloyds Bank plc' is a link to the company page, and the Incident contact heading links to its Contacts tab", async ({ page }) => {
    const partner = await db.issue.findFirstOrThrow({ where: { communicatorRule: "ISSUE_OWNER_PARTNER", number: { gt: 1042 } } });
    await signInAs(page, EMAIL.lukas);
    await page.goto(`/issues/${partner.id}`);
    const about = page.getByRole("region", { name: "About this issue" });
    await expect(about.getByRole("link", { name: "Lloyds Bank plc" })).toHaveAttribute("href", overview(partner.entityId));
    await expect(page.getByRole("region", { name: "Incident contact" }).getByRole("link", { name: "Incident contact at Lloyds Bank plc" })).toHaveAttribute("href", `/entities/${partner.entityId}/contacts`);
  });

  test("a linked customer issue shows both the customer and the partner as links; a standalone issue shows the customer", async ({ page }) => {
    const child = await db.issue.findFirstOrThrow({ where: { routingRule: "INHERITED_FROM_PARENT", entity: { legalName: "Revolut Ltd" } }, include: { parentLinks: { include: { parent: true } } } });
    await signInAs(page, EMAIL.adrian);
    await page.goto(`/issues/${child.id}`);
    const about = page.getByRole("region", { name: "About this issue" });
    await expect(about.getByRole("link", { name: "Revolut Ltd" })).toHaveAttribute("href", overview(child.entityId));
    await expect(about.getByRole("link", { name: "Lloyds Bank plc" })).toHaveAttribute("href", overview(child.parentLinks[0].parent.entityId));
    await expect(about.getByText("(partner outage)")).toBeVisible();

    const standalone = await issueByNumber(1038);
    await page.goto(`/issues/${standalone.id}`);
    await expect(page.getByRole("region", { name: "About this issue" }).getByRole("link", { name: "Revolut Ltd" })).toHaveAttribute("href", overview(standalone.entityId));
  });

  test("a viewer without access to the entity (a deleted record, for anyone but the admin) sees plain text, no link", async ({ page }) => {
    const child = await db.issue.findFirstOrThrow({ where: { routingRule: "INHERITED_FROM_PARENT", entity: { legalName: "Santander UK plc" } } });
    const admin = createAdminDb();
    await admin.entity.update({ where: { id: child.entityId }, data: { deletedAt: new Date(), deletedById: (await admin.user.findFirstOrThrow({ where: { email: EMAIL.adrian } })).id, deleteReason: "Deleted for the access test." } });
    try {
      await signInAs(page, EMAIL.kevin); // not the admin
      await page.goto(`/issues/${child.id}`);
      const about = page.getByRole("region", { name: "About this issue" });
      await expect(about.getByText("Santander UK plc", { exact: true })).toBeVisible();
      await expect(about.getByRole("link", { name: "Santander UK plc" })).toHaveCount(0);
      await expect(page.getByRole("region", { name: "Incident contact" }).getByRole("link", { name: /Incident contact at/ })).toHaveCount(0);
      await signInAs(page, EMAIL.adrian); // the admin still opens it
      await page.goto(`/issues/${child.id}`);
      await expect(page.getByRole("region", { name: "About this issue" }).getByRole("link", { name: "Santander UK plc" })).toBeVisible();
    } finally {
      await admin.entity.update({ where: { id: child.entityId }, data: { deletedAt: null, deletedById: null, deleteReason: null } });
      await admin.$disconnect();
    }
  });
});

async function labelledRows(page: Page, region: string) {
  const rows = page.getByRole("region", { name: region }).locator("dl > div");
  const out: Record<string, string> = {};
  for (let i = 0; i < (await rows.count()); i++) out[(await rows.nth(i).locator("dt").innerText()).trim()] = (await rows.nth(i).locator("dd").innerText()).trim();
  return out;
}

test.describe("Incident contact and About this issue", () => {
  test("Incident contact at <customer>: Name, Role, Phone (tel: link), Email (mailto: link), Local time, then the link to all contacts; no chips, no availability row", async ({ page }) => {
    const iss = await issueByNumber(1038);
    for (const email of [EMAIL.kevin, EMAIL.adrian, EMMA]) {
      await signInAs(page, email);
      await page.goto(`/issues/${iss.id}`);
      const block = page.getByRole("region", { name: "Incident contact" });
      await expect(block.getByRole("heading", { name: "Incident contact at Revolut Ltd" })).toBeVisible();
      const rows = await labelledRows(page, "Incident contact");
      expect(Object.keys(rows)).toEqual(["Name", "Role", "Phone", "Email", "Local time"]);
      expect(rows.Name).toBe("Priya Nair");
      expect(rows.Role).toBe("Payments Incident Lead");
      expect(rows["Local time"]).toMatch(/^Europe\/London, \d\d:\d\d (BST|GMT)$/);
      await expect(block.getByRole("link", { name: "+447700900456" })).toHaveAttribute("href", "tel:+447700900456");
      await expect(block.getByRole("link", { name: "priya.nair@revolut.example" })).toHaveAttribute("href", "mailto:priya.nair@revolut.example");
      await expect(block.getByRole("link", { name: "All incident and escalation contacts" })).toBeVisible();
      await expect(block).not.toContainText("24/7");
      await expect(block).not.toContainText("Available now");
      await expect(block).not.toContainText("Primary");
    }
  });

  test("the partner issue says 'Incident contact at Lloyds Bank plc'", async ({ page }) => {
    const partner = await db.issue.findFirstOrThrow({ where: { communicatorRule: "ISSUE_OWNER_PARTNER", number: { gt: 1042 } } });
    await signInAs(page, EMAIL.lukas);
    await page.goto(`/issues/${partner.id}`);
    await expect(page.getByRole("region", { name: "Incident contact" }).getByRole("heading", { name: "Incident contact at Lloyds Bank plc" })).toBeVisible();
  });

  test("About this issue: the customer's name in bold, the same label column as the Timeline next to it", async ({ page }) => {
    const iss = await issueByNumber(1038);
    await signInAs(page, EMAIL.kevin);
    await page.goto(`/issues/${iss.id}`);
    const about = page.getByRole("region", { name: "About this issue" });
    const name = about.getByText("Revolut Ltd", { exact: true });
    expect(Number(await name.evaluate((el) => getComputedStyle(el).fontWeight))).toBeGreaterThanOrEqual(600);
    const aboutLabel = await about.locator("dt").first().boundingBox();
    const aboutValue = await about.locator("dd").first().boundingBox();
    const timeline = page.getByRole("region", { name: "Timeline" });
    const tlLabel = await timeline.locator("dt").first().boundingBox();
    const tlValue = await timeline.locator("dd").first().boundingBox();
    expect(Math.round(aboutValue!.x - aboutLabel!.x)).toBe(Math.round(tlValue!.x - tlLabel!.x)); // the same label column width
  });
});

