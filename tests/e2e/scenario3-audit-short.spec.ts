import "dotenv/config";

import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { signUserCookie, SESSION_COOKIE } from "@/server/session";
import { db } from "@/server/db";
import { formatDate } from "@/lib/dates";

/**
 * Brief 7.3.2 E2E-3 `scenario3-audit.spec.ts`, R1 short spec
 * (`scenario3-audit-short.spec.ts`). Release-split table: steps 1, 2,
 * 3 (assert "8 of 8 captured" only -- the earlier "5 of 8" check is
 * R2), 4 (assert only the top audit row -- no Field filter, R2), 6, 7,
 * 8. Steps 5 and 9 are left out (R1-capable/R2, 7.3.2's own table).
 */
const FROZEN_TIME = new Date("2026-10-02T09:00:00+03:00");

test.describe.configure({ mode: "serial" });

async function resetDemoData(request: APIRequestContext) {
  const adrian = await db.user.findUniqueOrThrow({ where: { email: "adrian.koh@corvane.example" } });
  const cookie = `${SESSION_COOKIE}=${signUserCookie(adrian.id)}`;
  const res = await request.post("/api/demo/reset", { headers: { cookie } });
  expect(res.ok()).toBe(true);
}

async function viewAs(page: Page, optionLabel: string) {
  await page.getByRole("combobox", { name: "View as" }).click();
  await page.getByRole("option", { name: optionLabel }).click();
  await expect(page.getByText("Now viewing as")).toBeVisible();
}

test.describe("Scenario 3: Audit (R1 short spec)", () => {
  test.beforeEach(async ({ page, request }) => {
    test.setTimeout(120_000);
    await resetDemoData(request);
    await page.clock.install({ time: FROZEN_TIME });
  });

  test("Compliance reviews KYB expiries and updates Adyen's licence; Ops deletes and reactivates Monzo", async ({ page, request }) => {
    // Step 1: viewAs COMPLIANCE. Home "KYB and review expiries" buckets.
    await page.goto("/");
    await viewAs(page, "Compliance · Mei Chen");
    const kyb = page.locator("#worklist-kyb-expiries");
    await expect(kyb.getByText("Banco Santander Consumer Portugal S.A.")).toBeVisible();
    await expect(kyb.getByText("LEI lapsed in GLEIF")).toBeVisible();
    await expect(kyb.getByText("Banca Monte dei Paschi di Siena S.p.A.")).toBeVisible();
    await expect(kyb.getByText(/Periodic review overdue since 27 Sep 2026/)).toBeVisible();
    await expect(kyb.getByText(/Adyen N\.V\./)).toBeVisible();
    await expect(kyb.getByText(/Licence expires in 23 days \(25 Oct 2026\)/)).toBeVisible();

    // Step 2: open the Adyen item, assert the 4 KYB cards.
    const adyen = await db.entity.findFirstOrThrow({ where: { legalName: "Adyen N.V." } });
    await page.goto(`/entities/${adyen.id}/compliance`);
    await expect(page.getByText("Licence", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Expiring").first()).toBeVisible();
    await expect(page.getByText(/Verified by Mei Chen on 01 Nov 2024/).first()).toBeVisible();
    await expect(page.getByText("Planned").first()).toBeVisible();

    // Step 3: "Update verification" on Licence -- a disallowed host is rejected, the approved one saves.
    await page.getByRole("button", { name: "Update verification" }).first().click();
    const licenceDialog = page.getByRole("dialog");
    await licenceDialog.getByLabel("Licence number").fill("DNB-BL-0412");
    await licenceDialog.getByLabel("Issuing authority").fill("De Nederlandsche Bank");
    await licenceDialog.getByLabel("Expiry date", { exact: true }).fill("2028-03-31");
    await licenceDialog.getByLabel("Evidence link").fill("https://drive.example.com/adyen-licence.pdf");
    await licenceDialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Use a link to approved document storage")).toBeVisible();

    await licenceDialog.getByLabel("Evidence link").fill("https://docs.corvane-internal.example/adyen/licence-2026.pdf");
    await licenceDialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Verification saved")).toBeVisible();
    await expect(page.getByText("Verified", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("8 of 8 captured")).toBeVisible();

    // Step 4: Audit tab -- one row per changed field, same timestamp; find the Expiry date row by its new value.
    await page.getByRole("link", { name: "Audit", exact: true }).click();
    const expiryRow = page.getByRole("row").filter({ hasText: "Expiry date" }).filter({ hasText: "31 Mar 2028" });
    await expect(expiryRow).toContainText("KYB: Licence");
    await expect(expiryRow).toContainText("25 Oct 2026");
    await expect(expiryRow).toContainText("31 Mar 2028");
    await expect(expiryRow).toContainText("Mei Chen");
    await expect(expiryRow).toContainText("Compliance");
    // The audit time is in the viewer's own zone, with the label the rest of the app uses, never "UTC+hh:mm".
    await expect(expiryRow).toContainText(/\d\d:\d\d (CEST|CET|MYT|SGT)/);
    await expect(expiryRow).not.toContainText("UTC+");

    // Step 6: Admin menu shows only "Roles & permissions" for Compliance.
    await page.goto("/");
    await page.getByRole("button", { name: "Admin" }).click();
    await expect(page.getByRole("menuitem", { name: "Roles & permissions" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Deleted records" })).toHaveCount(0);
    await page.getByRole("menuitem", { name: "Roles & permissions" }).click();
    await expect(page.getByText("Generated from the permission matrix the server enforces. Read-only.")).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Sales" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Compliance" })).toBeVisible();

    // Step 7: viewAs OPS, delete Monzo Bank Ltd.
    await page.goto("/");
    await viewAs(page, "Ops · Adrian Koh");
    const monzo = await db.entity.findFirstOrThrow({ where: { legalName: "Monzo Bank Ltd" } });
    await page.goto(`/entities/${monzo.id}/overview`);
    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Delete record" }).click();
    const deleteDialog = page.getByRole("dialog");
    const deleteButton = deleteDialog.getByRole("button", { name: "Delete", exact: true });
    await deleteDialog.getByLabel("Reason").fill("Created t"); // 9 characters -- below the 10-character minimum, stays disabled
    await expect(deleteButton).toBeDisabled();
    await deleteDialog.getByLabel("Reason").fill("Created twice during the CRM import");
    await expect(deleteButton).toBeEnabled();
    await deleteButton.click();
    await expect(page.getByText("Monzo Bank Ltd deleted. Find it in Admin > Deleted records.")).toBeVisible();
    // deletedAt is written by the server's own real-time-advancing clock (lib/dates.ts's
    // DEMO_CLOCK_START + real elapsed time since the dev server process started), which
    // drifts independently of this test's frozen browser clock -- read it back from the
    // DB rather than assuming it matches FROZEN_TIME.
    const deletedMonzo = await db.entity.findUniqueOrThrow({ where: { id: monzo.id } });
    const deletedDateLabel = formatDate(deletedMonzo.deletedAt!.toISOString().slice(0, 10));
    await expect(page.getByText(`Deleted by Adrian Koh on ${deletedDateLabel}. Reason: Created twice during the CRM import`)).toBeVisible();

    await page.goto("/search?q=monzo");
    await expect(page.getByText("No institutions match 'monzo'.")).toBeVisible();

    await page.goto("/");
    await viewAs(page, "Customer Success · Emma Wilson");
    await page.goto(`/entities/${monzo.id}/overview`);
    await expect(
      page.getByText(`This record was deleted on ${deletedDateLabel}. Contact the admin, Adrian Koh, if it should be restored.`),
    ).toBeVisible();

    // Step 8: as Adrian, Deleted records lists Monzo first; Reactivate.
    await page.goto("/");
    await viewAs(page, "Ops · Adrian Koh");
    await page.goto("/admin/deleted-records");
    const rows = page.getByRole("row");
    await expect(rows.nth(1)).toContainText("Monzo Bank Ltd");
    await expect(page.getByText("Lloyds Bank (legacy import)")).toBeVisible();
    await page.getByRole("button", { name: "Reactivate" }).first().click();
    await expect(page.getByRole("heading", { name: "Reactivate Monzo Bank Ltd?" })).toBeVisible();
    await expect(page.getByText("All its data returns to search and worklists.")).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Reactivate", exact: true }).click();
    await expect(page.getByText("Monzo Bank Ltd reactivated")).toBeVisible();

    await page.goto(`/entities/${monzo.id}/overview`);
    await expect(page.getByText("Owner: Ethan Brooks").first()).toBeVisible();
    await expect(page.getByText("Kickoff").first()).toBeVisible();

    await page.goto("/search?q=monzo");
    await expect(page.getByText("Monzo Bank Ltd")).toBeVisible();

    // Forged write: Sales cannot delete an entity (M15 permission regression).
    const tom = await db.user.findFirstOrThrow({ where: { name: "Tom Hadley" } });
    const forged = await request.post(`/api/entities/${adyen.id}/delete`, {
      headers: { cookie: `${SESSION_COOKIE}=${signUserCookie(tom.id)}` },
      data: { reason: "Forged delete attempt, should be rejected" },
    });
    expect(forged.status()).toBe(403);
  });
});
