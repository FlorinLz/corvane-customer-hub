import "dotenv/config";

import { expect, test, type Page } from "@playwright/test";

import { db } from "@/server/db";
import { resetDemoData } from "./fixtures/reset";

/**
 * Brief 7.3.2 E2E-4 `scenario4-csm-day.spec.ts`, R1 short spec
 * (`scenario4-csm-day-short.spec.ts`). Release-split table: steps 1,
 * 2, 3, 4, 6, and a modified 7 (open Adyen N.V. directly from Search
 * rather than via Home's "My team" toggle, which is R2; the Reassign
 * flow itself is unchanged). Steps 5 and 8 are left out (R2).
 */
const FROZEN_TIME = new Date("2026-10-02T09:00:00+03:00");

test.describe.configure({ mode: "serial" });

async function viewAs(page: Page, optionLabel: string) {
  await page.getByRole("combobox", { name: "View as" }).click();
  await page.getByRole("option", { name: optionLabel }).click();
  await expect(page.getByText("Now viewing as")).toBeVisible();
}

test.describe("Scenario 4: CSM day (R1 short spec)", () => {
  test.beforeEach(async ({ page, request }) => {
    test.setTimeout(120_000);
    await resetDemoData(request);
    await page.clock.install({ time: FROZEN_TIME });
  });

  test("Emma acknowledges an assignment, reviews a renewal, adds a note, and reassigns Adyen", async ({ page }) => {
    // Step 1: viewAs CS. Home badge "1"; "Ownership assigned to you" (UniCredit Bank GmbH from Leo Martin); "Renewals in the next 120 days" (UniCredit Overdue first, MPS 61-90 days).
    await page.goto("/");
    await viewAs(page, "Customer Success · Emma Wilson");
    await expect(page.getByRole("link", { name: "Home, 1 unacknowledged assignment" })).toBeVisible();

    const assignedSection = page.locator("#worklist-ownership-assigned");
    const uniCreditRow = assignedSection.getByText("UniCredit Bank GmbH").locator("..");
    await expect(uniCreditRow).toContainText("Leo Martin");
    await expect(uniCreditRow).toContainText("Rebalancing German accounts before Q4");

    const renewalsSection = page.locator("#worklist-renewals");
    const rows = await renewalsSection.locator("div.flex.flex-wrap").all();
    const firstRenewalText = await rows[0].innerText();
    expect(firstRenewalText).toContain("UniCredit Bank GmbH");
    expect(firstRenewalText).toContain("Overdue");
    await expect(renewalsSection.getByText(/Banca Monte dei Paschi di Siena S\.p\.A\./)).toBeVisible();

    // Step 2: Acknowledge the UniCredit Bank GmbH assignment -- row leaves without reload, badge hidden.
    await uniCreditRow.getByRole("button", { name: "Acknowledge" }).click();
    await expect(page.locator("#worklist-ownership-assigned").getByText("UniCredit Bank GmbH")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Home", exact: true })).toBeVisible();

    // Step 3: open the MPS renewal row -- Details, Customer role card, renewal date editable for CS.
    await renewalsSection.getByText(/Banca Monte dei Paschi di Siena S\.p\.A\./).locator("..").getByRole("link", { name: "Open" }).click();
    await expect(page).toHaveURL(/\/entities\/.+\/details/);
    await expect(page.getByText("Owned by Ops").first()).toBeVisible();
    await expect(page.getByText("Owned by Sales").first()).toBeVisible();

    // Step 4: Overview -- key people, "Latest interactions", the periodic-review alert.
    const mps = await db.entity.findFirstOrThrow({ where: { legalName: "Banca Monte dei Paschi di Siena S.p.A." } });
    await page.goto(`/entities/${mps.id}/overview`);
    await expect(page.getByText("Latest interactions")).toBeVisible();
    await expect(page.getByText(/Periodic review overdue since 27 Sep 2026/)).toBeVisible();

    // Step 6: Add note (QBR), with a negative check on the summary's minimum length.
    await page.goto(`/entities/${mps.id}/history`);
    await page.getByRole("button", { name: "Add note" }).click();
    const noteDialog = page.getByRole("dialog");
    await noteDialog.getByRole("combobox", { name: "Type" }).click();
    await page.getByRole("option", { name: "QBR" }).click();
    await noteDialog.getByRole("combobox", { name: "Add colleague" }).click();
    await page.getByRole("option", { name: "Emma Wilson" }).click();
    await noteDialog.getByRole("combobox", { name: "Add colleague" }).click();
    await page.getByRole("option", { name: "Tom Hadley" }).click();
    await noteDialog.getByRole("combobox", { name: "Add contact" }).click();
    await page.getByRole("option", { name: "Giulia Ferri" }).click();

    await noteDialog.getByLabel("Summary").fill("Too short");
    await expect(noteDialog.getByRole("button", { name: "Save note" })).toBeDisabled();

    await noteDialog.getByLabel("Summary").fill(
      "Q3 review, volumes on track in DE. MPS asked for a renewal proposal with DE volume tiers before the renewal date.",
    );
    await noteDialog.getByRole("button", { name: "+ Add action item" }).click();
    await noteDialog.getByRole("textbox", { name: "Action item description" }).first().fill("Send renewal proposal with DE volume tiers");
    await noteDialog.getByRole("combobox", { name: "Action item owner" }).first().click();
    await page.getByRole("option", { name: "Tom Hadley" }).click();
    await noteDialog.getByRole("textbox", { name: "Action item due date" }).first().fill("2026-10-16");

    await noteDialog.getByRole("button", { name: "+ Add action item" }).click();
    await noteDialog.getByRole("textbox", { name: "Action item description" }).nth(1).fill("Share EU VoP / DE ramp-up plan");
    await noteDialog.getByRole("combobox", { name: "Action item owner" }).nth(1).click();
    await page.getByRole("option", { name: "Emma Wilson" }).click();
    await noteDialog.getByRole("textbox", { name: "Action item due date" }).nth(1).fill("2026-10-09");

    await noteDialog.getByRole("button", { name: "Save note" }).click();
    await expect(page.getByText("Note added")).toBeVisible();
    const timelineFirst = page.locator("main").getByText("Q3 review, volumes on track in DE").first();
    await expect(timelineFirst).toBeVisible();
    await page.goto(`/entities/${mps.id}/overview`);
    await expect(page.getByText("Q3 review, volumes on track in DE")).toBeVisible();

    // Step 7 (modified): open Adyen N.V. from Search (not via the R2 "My team" toggle), then Reassign owner.
    await page.goto("/search?q=adyen");
    await page.getByRole("link", { name: "Adyen N.V." }).click();
    await expect(page).toHaveURL(/\/entities\/.+\/overview/);
    await page.getByRole("button", { name: "Reassign owner" }).click();
    const reassignDialog = page.getByRole("dialog");
    await reassignDialog.getByRole("combobox", { name: "New owner" }).click();
    await expect(page.getByRole("option", { name: "Sophie Mitchell" })).toBeVisible();
    await page.getByRole("option", { name: "Sophie Mitchell" }).click();
    await reassignDialog.getByLabel("Reason").fill("short");
    await expect(reassignDialog.getByRole("button", { name: "Reassign" })).toBeDisabled();
    await reassignDialog.getByLabel("Reason").fill("Leo on parental leave until February 2027");
    await reassignDialog.getByRole("button", { name: "Reassign" }).click();
    await expect(page.getByText("Owner changed to Sophie Mitchell")).toBeVisible();
    await expect(page.getByText("Owner: Sophie Mitchell, Customer Success").first()).toBeVisible();

    await page.getByRole("link", { name: "History", exact: true }).click();
    await expect(page.getByText(/Owner reassigned/)).toBeVisible();
    await expect(page.getByText(/Leo on parental leave until February 2027/)).toBeVisible();
  });
});
