import "dotenv/config";

import { expect, test, type Page } from "@playwright/test";

import { resetDemoData } from "./fixtures/reset";

/**
 * Brief 7.3.2 E2E-2 `scenario2-partner-incident.spec.ts`, R1 short spec.
 * Release-split table: steps 1 (via Enter, not typeahead), 3, 5, 6
 * (without the Role click). Setup per 7.3.2's shared block.
 */

const FROZEN_TIME = new Date("2026-10-02T09:00:00+03:00");

test.describe.configure({ mode: "serial" });

/** Brief 7.3.2: "Helper viewAs(team) uses the switcher in the demo strip." */
async function viewAs(page: Page, optionLabel: string) {
  await page.getByRole("combobox", { name: "View as" }).click();
  await page.getByRole("option", { name: optionLabel }).click();
  await expect(page.getByText(`Now viewing as`)).toBeVisible();
}

test.describe("Scenario 2: Partner incident (R1 short spec)", () => {
  test.beforeEach(async ({ page, request }) => {
    test.setTimeout(120_000); // first hit on a cold Turbopack dev server compiles every route it touches
    await resetDemoData(request);
    await page.clock.install({ time: FROZEN_TIME });
  });

  test("Network changes coverage status; Compliance sees the same filtered search and sorted obligations", async ({ page }) => {
    // Step 1: viewAs NETWORK, search "lloyds" via Enter (not typeahead), open the result.
    await page.goto("/");
    await viewAs(page, "Network · Lukas Brenner");

    const searchBox = page.getByRole("searchbox", { name: "Search by name, alias, LEI or BIC" });
    await searchBox.fill("lloyds");
    await searchBox.press("Enter");
    await expect(page).toHaveURL(/\/search\?q=lloyds/);

    await page.getByRole("link", { name: "Lloyds Bank plc", exact: true }).click();
    await expect(page).toHaveURL(/\/entities\/.+\/overview/);

    const incidentBlock = page.getByRole("region", { name: "Incident contact" });
    await expect(incidentBlock.getByText("Paul Grant")).toBeVisible();
    await expect(incidentBlock.getByRole("link", { name: "+447700900123" })).toHaveAttribute("href", "tel:+447700900123");
    await expect(incidentBlock.getByRole("button", { name: "Copy phone number" })).toBeVisible();
    await expect(incidentBlock.getByText("Europe/London")).toBeVisible();
    await expect(incidentBlock.getByText("24/7")).toBeVisible();
    await expect(incidentBlock.getByText("Available now")).toBeVisible();
    await expect(incidentBlock.getByText(/Verified 12 Sep 2026/)).toBeVisible();

    // Step 3: Partner tab, Change status on UK CoP / GB -> Degraded.
    await page.getByRole("link", { name: "Partner", exact: true }).click();
    await expect(page).toHaveURL(/\/partner$/);

    const ukCopRow = page.locator("details", { hasText: "GB United Kingdom" }).first();
    await ukCopRow.getByRole("button", { name: "Change status" }).click();

    const dialog = page.getByRole("dialog", { name: /Change status/ });
    await dialog.getByRole("radio", { name: "Degraded" }).check();
    await dialog.getByLabel("Reason").fill("Response times above 2s on CoP requests");
    await dialog.getByRole("button", { name: "Save status" }).click();
    await expect(page.getByText("Coverage status saved")).toBeVisible();

    const ukCopSummary = ukCopRow.locator("summary");
    await expect(ukCopSummary.getByText("Degraded", { exact: true })).toBeVisible();
    await expect(ukCopSummary.getByText("since 02 Oct 2026")).toBeVisible();
    await expect(ukCopSummary.getByText("0 days in status")).toBeVisible();

    await ukCopRow.locator("summary").click();
    await expect(ukCopRow.getByText(/^Active · effective/)).toBeVisible();
    await expect(ukCopRow.getByText(/^Onboarding · effective/)).toBeVisible();

    await expect(page.getByText("Network partner").locator("..").locator(".bg-due, [class*='bg-due']")).toBeVisible();

    // Step 5: Search, clear text, filter Country GB + Scheme UK CoP.
    await page.goto("/search");
    await page.getByRole("checkbox", { name: /^GB United Kingdom$/ }).check();
    await page.getByRole("checkbox", { name: /UK CoP/ }).check();
    await page.getByRole("button", { name: "Apply filters" }).click();

    await expect(page).toHaveURL(/country=GB/);
    await expect(page).toHaveURL(/scheme=UK_COP/);
    await expect(page.getByText("4 institutions")).toBeVisible();

    await expect(page.getByRole("link", { name: "Revolut Ltd" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Santander UK plc" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Zopa Bank Limited" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Lloyds Bank plc", exact: true })).toBeVisible();

    const lloydsRow = page.locator("tr", { has: page.getByRole("link", { name: "Lloyds Bank plc", exact: true }) });
    await expect(lloydsRow.getByText("Customer", { exact: true })).toBeVisible();
    await expect(lloydsRow.getByText("Network partner", { exact: true })).toBeVisible();
    await expect(lloydsRow.getByText(/Degraded/)).toBeVisible();

    const searchUrl = page.url();

    // Step 6 (without the Role click): viewAs COMPLIANCE, same filters, switch to Obligations, sort Incident notice ascending.
    await viewAs(page, "Compliance · Mei Chen");
    await expect(page).toHaveURL(searchUrl);

    await page.getByRole("link", { name: "Obligations" }).click();
    const sortUrl = new URL(searchUrl);
    sortUrl.searchParams.set("view", "obligations");
    sortUrl.searchParams.set("osort", "in_asc");
    await page.goto(sortUrl.pathname + sortUrl.search);

    await expect(page.getByText("4 agreements")).toBeVisible();
    const obligationRows = page.locator("table tbody tr");
    await expect(obligationRows).toHaveCount(4);
    await expect(obligationRows.nth(0)).toContainText("Revolut Ltd");
    await expect(obligationRows.nth(0)).toContainText("2 h");
    await expect(obligationRows.nth(1)).toContainText("Santander UK plc");
    await expect(obligationRows.nth(1)).toContainText("4 h");
    await expect(obligationRows.nth(2)).toContainText("Lloyds Bank plc");
    await expect(obligationRows.nth(2)).toContainText("8 h");
    await expect(obligationRows.nth(3)).toContainText("Zopa Bank Limited");
    await expect(obligationRows.nth(3)).toContainText("Not captured");

    const revolutLink = obligationRows.nth(0).getByRole("link", { name: "Open" });
    await expect(revolutLink).toHaveAttribute("target", "_blank");
    const href = await revolutLink.getAttribute("href");
    expect(href).toBeTruthy();
    expect(new URL(href!).hostname).toBe("docs.corvane-internal.example");
  });
});
