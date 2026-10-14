import "dotenv/config";

import { expect, test, type Page } from "@playwright/test";

import { signUserCookie, SESSION_COOKIE } from "@/server/session";
import { db } from "@/server/db";
import { formatDate } from "@/lib/dates";
import { resetDemoData } from "./fixtures/reset";

/**
 * Brief 7.3.2 E2E-1 `scenario1-new-customer.spec.ts`, R1 short spec.
 * Release-split table: step 1 (click "New customer" only — the Home
 * worklist assertions are milestone 7), 2 to 7. Steps 8+ (Finance,
 * Ops pickup, stage changes, Ops -> CS) belong to later milestones.
 * The whole e2e suite runs with GLEIF_FORCE_CACHE=true (playwright.config.ts),
 * so this spec passing is itself the GLEIF_FORCE_CACHE=true check.
 */

const FROZEN_TIME = new Date("2026-10-02T09:00:00+03:00");
const SANTANDER_LEI = "5299000I7Y60A8273788";

test.describe.configure({ mode: "serial" });

/** Brief 7.3.2: "Helper viewAs(team) uses the switcher in the demo strip." */
async function viewAs(page: Page, optionLabel: string) {
  await page.getByRole("combobox", { name: "View as" }).click();
  await page.getByRole("option", { name: optionLabel }).click();
  await expect(page.getByText("Now viewing as")).toBeVisible();
}

async function selectOption(page: Page, comboboxName: string, optionName: string) {
  await page.getByRole("combobox", { name: comboboxName }).click();
  await page.getByRole("option", { name: optionName }).click();
}

test.describe("Scenario 1: New customer (R1 short spec)", () => {
  test.beforeEach(async ({ page, request }) => {
    test.setTimeout(180_000); // first hit on a cold Turbopack dev server compiles every route it touches
    await resetDemoData(request);
    await page.clock.install({ time: FROZEN_TIME });
  });

  test("Sales creates Santander Consumer Bank GmbH and hands it over to Ops", async ({ page, request }) => {
    // Step 1: viewAs SALES, click "New customer" (Home worklist assertions are milestone 7).
    await page.goto("/");
    await viewAs(page, "Sales · Tom Hadley");
    await page.getByRole("link", { name: "New customer" }).click();
    await expect(page).toHaveURL(/\/customers\/new/);

    // Step 2: entity type Bank, fill the LEI, look up. Assert the GLEIF fill and the group suggestion.
    await page.getByRole("button", { name: "Bank" }).click();
    await page.getByLabel("LEI *").fill(SANTANDER_LEI);
    await page.getByRole("button", { name: "Look up" }).click();

    await expect(page.getByText("Santander Consumer Bank GmbH").first()).toBeVisible();
    await expect(page.getByText("AT", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Issued", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("From GLEIF").first()).toBeVisible();
    await expect(page.getByText("Suggested from GLEIF parent")).toBeVisible();

    // Step 3: possible duplicates lists exactly 1 row (Santander Consumer Bank S.p.A.), checkbox + reason gate Next.
    await expect(page.getByText("Possible duplicates (1)")).toBeVisible();
    await expect(page.getByText("Santander Consumer Bank S.p.A.")).toBeVisible();
    await expect(page.getByText("549300O0YQXDOJB36Y73")).toBeVisible();
    await expect(page.getByText("Owner: Emma Wilson, Customer Success")).toBeVisible();
    await expect(page.getByRole("link", { name: "Open record (new tab)" })).toBeVisible();

    const nextButton = page.getByRole("button", { name: "Next", exact: true });
    await expect(nextButton).toBeDisabled();
    await page.getByText("I checked these records and this is a different legal entity").click();
    await page.getByLabel("Reason *").fill("Austrian sister company with its own LEI and local contract");
    await expect(nextButton).toBeEnabled();
    await nextButton.click();

    // Step 4: product lines, a past-date rejection, commercial terms, and the contracting-entity picker.
    await expect(page.getByRole("heading", { name: "Product lines" })).toBeVisible();
    await page.getByRole("button", { name: "Add product line" }).click();
    await selectOption(page, "Product or scheme", "EU VoP");
    await selectOption(page, "Country", "AT Austria");
    await selectOption(page, "Contracting entity", "Santander Consumer Bank GmbH");
    const goLive1 = page.getByLabel("Target go-live").first();
    await goLive1.fill("2026-10-01"); // in the past relative to the frozen clock
    await expect(page.getByText("Target go-live is in the past")).toBeVisible();
    await goLive1.fill("2026-12-17");

    await page.getByRole("button", { name: "Add product line" }).click();
    const rows = page.locator("tbody tr");
    const secondRow = rows.nth(1);
    await secondRow.getByRole("combobox", { name: "Product or scheme" }).click();
    await page.getByRole("option", { name: "Global validation" }).click();
    await secondRow.getByRole("combobox", { name: "Country" }).click();
    await page.getByRole("option", { name: "AT Austria" }).click();
    await secondRow.getByRole("combobox", { name: "Contracting entity" }).click();
    await page.getByRole("option", { name: "Santander Consumer Bank GmbH" }).click();
    await secondRow.getByLabel("Target go-live").fill("2027-01-30");

    // Contracting-entity picker lists the new entity plus the 4 existing Santander entities.
    await secondRow.getByRole("combobox", { name: "Contracting entity" }).click();
    for (const name of [
      "Santander Consumer Bank GmbH",
      "Santander UK plc",
      "Banco Santander Totta, S.A.",
      "Santander Consumer Bank S.p.A.",
      "Banco Santander Consumer Portugal S.A.",
    ]) {
      await expect(page.getByRole("option", { name })).toBeVisible();
    }
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "EUR" }).click();
    await page.getByLabel("Price per verification *").fill("0.04");
    await page.getByLabel("Payment term (days)").fill("30");
    await page.getByLabel("Availability %").fill("99.95");
    await page.getByRole("button", { name: "Next", exact: true }).click();

    // Step 5: one initial contact (Champion).
    await expect(page.getByRole("heading", { name: "Contact 1" })).toBeVisible();
    await page.getByLabel("Full name *").fill("Katharina Huber");
    await page.getByLabel("Job title").fill("Head of Payments");
    await page.getByLabel("Email *").fill("katharina.huber@scb-at.example");
    await page.getByLabel("Phone").fill("+436641234567");
    await page.getByRole("button", { name: "Next", exact: true }).click();

    // Step 6: Onboarding Manager picker lists exactly the two Ops users.
    await expect(page.getByRole("heading", { name: "Entity" })).toBeVisible();
    await page.getByRole("combobox", { name: "Onboarding Manager *" }).click();
    await expect(page.getByRole("option", { name: "Adrian Koh (Ops)" })).toBeVisible();
    await expect(page.getByRole("option", { name: "Kevin Lim (Ops)" })).toBeVisible();
    await expect(page.getByRole("option")).toHaveCount(2);
    await page.getByRole("option", { name: "Adrian Koh (Ops)" }).click();
    await page.getByRole("button", { name: "Create customer and hand over" }).click();

    // Step 7: the created record.
    await expect(page).toHaveURL(/\/entities\/.+\/overview/, { timeout: 15_000 });
    await expect(page.getByText("Owner: Tom Hadley, Sales").first()).toBeVisible();
    // sentAt is written by the server's own real-time-advancing clock, which drifts
    // independently of this test's frozen browser clock -- read it back from the DB.
    const scbEntityId = page.url().match(/\/entities\/([^/]+)\//)![1];
    const salesToOpsHandoff = await db.handoff.findFirstOrThrow({ where: { entityId: scbEntityId, type: "SALES_TO_OPS" } });
    await expect(page.getByText(`Handoff to Adrian Koh pending since ${formatDate(salesToOpsHandoff.sentAt.toISOString().slice(0, 10))}`)).toBeVisible();
    await expect(page.getByText("Onboarding", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Incomplete for billing").first()).toBeVisible();

    await page.getByRole("link", { name: "History", exact: true }).click();
    await expect(page.getByText("Record created by Tom Hadley (Sales)")).toBeVisible();
    await expect(page.getByText("Duplicate warning acknowledged: Austrian sister company with its own LEI and local contract")).toBeVisible();

    // Step 9: viewAs OPS. Confirm pickup from "To pick up", then "Required fields empty" lists the new customer.
    await page.goto("/");
    await viewAs(page, "Ops · Adrian Koh");
    const toPickUpSection = page.locator("#worklist-to-pick-up");
    await expect(toPickUpSection.getByText("Santander Consumer Bank GmbH")).toBeVisible();
    await expect(toPickUpSection.getByText(/from Tom Hadley/)).toBeVisible();
    await toPickUpSection.getByRole("link", { name: "Open" }).click();
    await expect(page.getByRole("button", { name: "Confirm pickup" })).toBeVisible();
    await page.getByRole("button", { name: "Confirm pickup" }).click();
    await expect(page.getByText("Pickup confirmed")).toBeVisible();
    await page.goto(`/entities/${(await db.entity.findFirstOrThrow({ where: { legalName: "Santander Consumer Bank GmbH" } })).id}/overview`);
    await expect(page.getByText("Owner: Adrian Koh, Ops").first()).toBeVisible();

    await page.goto("/");
    await expect(page.locator("#worklist-to-pick-up").getByText("Santander Consumer Bank GmbH")).toHaveCount(0);
    const requiredFieldsSection = page.locator("#worklist-required-fields");
    const scbRow = requiredFieldsSection.getByText("Santander Consumer Bank GmbH").locator("..");
    await expect(scbRow).toContainText("Active Technical contact");
    await expect(scbRow).toContainText("Active Incident contact");
    await expect(scbRow).toContainText("No contract attached");

    // Step 10: Products & onboarding, Change stage on EU VoP / AT to Kickoff.
    const scb = await db.entity.findFirstOrThrow({ where: { legalName: "Santander Consumer Bank GmbH" } });
    await page.goto(`/entities/${scb.id}/products`);
    await page.getByRole("button", { name: "Change stage" }).first().click();
    await page.getByRole("button", { name: "Save stage" }).click();
    await expect(page.getByText("Stage saved")).toBeVisible();
    await expect(page.getByText("Kickoff").first()).toBeVisible();
    await expect(page.getByText("Contract signed").first()).toBeVisible(); // Global validation / AT is still at its original stage

    await page.getByRole("link", { name: "Santander" }).click();
    await expect(page.getByText(/Entities/)).toBeVisible();
    await expect(page.getByText("5", { exact: true })).toBeVisible();

    // Step 11: open Revolut Ltd from "Too long in current stage", move UK CoP / GB from Live & hypercare to Ramp-up (decision B14, an R1 forward move).
    await page.goto("/");
    const tooLongSection = page.locator("#worklist-too-long");
    await expect(tooLongSection.getByText("Revolut Ltd")).toBeVisible();
    await tooLongSection.getByText("Revolut Ltd").locator("..").getByRole("link", { name: "Open" }).click();
    await expect(page).toHaveURL(/\/entities\/.+\/products/);
    await page.getByRole("button", { name: "Change stage" }).first().click();
    await page.getByRole("button", { name: "Save stage" }).click();
    await expect(page.getByText("Stage saved")).toBeVisible();
    await expect(page.getByText("Ramp-up").first()).toBeVisible();
    await expect(page.getByText(/Billable from 03 Aug 2026/)).toBeVisible();
    await expect(page.getByText("UAT").first()).toBeVisible(); // EU VoP / DE, still blocked

    await page.goto("/");
    await expect(page.locator("#worklist-too-long").getByText("Revolut Ltd")).toHaveCount(0);

    // Step 12: Revolut, "Hand over to Customer Success" through its 4 sections, send to Emma Wilson.
    const revolut = await db.entity.findFirstOrThrow({ where: { legalName: "Revolut Ltd" } });
    await page.goto(`/entities/${revolut.id}/overview`);
    await page.getByRole("button", { name: "Hand over to Customer Success" }).click();
    await expect(page.getByText("Product stages")).toBeVisible();
    await expect(page.getByText("Open blocks")).toBeVisible();
    await expect(page.getByText("Commitments to the customer")).toBeVisible();
    await expect(page.getByText("Confirmed contacts")).toBeVisible();

    await page.getByLabel(/Blocked by Customer/).fill("Customer to deliver certificates, Adrian follows up weekly");
    await page.getByRole("button", { name: "Add commitment" }).click();
    await page.getByLabel("Commitment 1 description").fill("Weekly status call until full UK CoP volume");
    await page.getByText("Oskar Lindqvist").locator("..").getByRole("checkbox").check();
    await page.getByText("Priya Nair").locator("..").getByRole("checkbox").check();
    await page.getByLabel("Receiving CSM").click();
    await page.getByRole("option", { name: "Emma Wilson" }).click();
    await page.getByRole("button", { name: "Send handoff" }).click();
    await expect(page.getByText("Handoff sent")).toBeVisible();
    const opsToCsHandoff = await db.handoff.findFirstOrThrow({ where: { entityId: revolut.id, type: "OPS_TO_CS" } });
    await expect(page.getByText(`Handoff to Emma Wilson pending since ${formatDate(opsToCsHandoff.sentAt.toISOString().slice(0, 10))}`)).toBeVisible();
    await expect(page.getByText("Owner: Adrian Koh, Ops").first()).toBeVisible();

    await page.goto("/");
    await expect(page.locator("#worklist-awaiting-acceptance").getByText("Revolut Ltd")).toBeVisible();

    // Step 13: forged API check -- as Sales, PATCH the stage endpoint on a Revolut product returns 403 with owner_team "Ops".
    const revolutLine = await db.contractedProduct.findFirstOrThrow({ where: { entityId: revolut.id, product: "UK_COP" } });
    const tom = await db.user.findFirstOrThrow({ where: { name: "Tom Hadley" } });
    const forged = await request.post(`/api/products/${revolutLine.id}/stage`, {
      headers: { cookie: `${SESSION_COOKIE}=${signUserCookie(tom.id)}` },
      data: { toStage: "BAU", entryDate: "2026-10-02", version: revolutLine.version },
    });
    expect(forged.status()).toBe(403);
    expect((await forged.json()).owner_team).toBe("Ops");
  });
});
