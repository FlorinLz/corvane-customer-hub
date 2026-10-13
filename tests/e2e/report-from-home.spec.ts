import "dotenv/config";

import { expect, test, type Page } from "@playwright/test";

import { db } from "@/server/db";

import { EMAIL, resetDemoData, signInAs } from "./fixtures/role-actions-setup";

/**
 * Report issue from Home and the simpler product line, scheme and country (Part A and B). Runs only under the `role-actions` Playwright
 * project: a production build, demo clock Mon 05 Oct 2026, 10:48 CEST. Emma Wilson (Customer Success) reports on Revolut Ltd, Lukas Brenner
 * (Network) on Lloyds Bank plc (a customer and a partner, with one UK CoP / GB coverage).
 */

test.describe.configure({ mode: "serial" });

const EMMA = "emma.wilson@corvane.example";

test.beforeAll(async ({ browser }) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({ baseURL: "http://localhost:3104" });
  await resetDemoData(context.request);
  await context.close();
});

test.beforeEach(async ({ context }) => {
  await context.route("https://mail.google.com/**", (r) => r.fulfill({ body: "ok" }));
});

async function openFromHome(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Report issue" }).click();
  const drawer = page.getByRole("dialog", { name: "Report issue" });
  await expect(drawer.getByRole("combobox", { name: "Affected entity *" })).toBeFocused(); // the search has focus when the drawer opens
  return drawer;
}

async function pickEntity(page: Page, drawer: ReturnType<Page["getByRole"]>, query: string, name: string) {
  await drawer.getByRole("combobox", { name: "Affected entity *" }).fill(query);
  await page.getByRole("option", { name: new RegExp(name) }).first().click();
  await expect(drawer.getByTestId("picked-entity")).toHaveText(name);
}

async function fillTheRest(drawer: ReturnType<Page["getByRole"]>, page: Page, description: string) {
  await drawer.getByLabel("Description").fill(description);
  await drawer.getByRole("combobox", { name: "Reported at the customer by" }).click();
  await page.getByRole("option", { name: "Found by Corvane" }).click();
  await drawer.getByRole("radio", { name: "Degraded" }).check();
  await drawer.getByRole("radio", { name: "No" }).check();
}

test.describe("Report issue from Home", () => {
  test("every team has the button next to the 'My worklist' title, secondary, with an accessible name", async ({ page }) => {
    for (const email of [EMMA, EMAIL.lukas, EMAIL.kevin, EMAIL.adrian, EMAIL.mei, "rachel.wong@corvane.example"]) {
      await signInAs(page, email);
      await page.goto("/");
      const button = page.getByRole("button", { name: "Report issue" });
      await expect(button, email).toBeVisible();
      expect(await button.evaluate((el) => el.className.includes("bg-primary")), `${email} secondary`).toBe(false);
      const title = await page.getByRole("heading", { name: "My worklist" }).boundingBox();
      const box = await button.boundingBox();
      expect(Math.abs(box!.y + box!.height / 2 - (title!.y + title!.height / 2)), `${email}: in the header row`).toBeLessThan(60);
    }
  });

  test("as Emma Wilson: search a customer, pick a product line, report from Home; the new issue page opens", async ({ page }) => {
    await signInAs(page, EMMA);
    const drawer = await openFromHome(page);
    // Nothing else is prefilled or shown before an entity is picked.
    await expect(drawer.getByRole("combobox", { name: "Type" })).toHaveCount(0);

    await drawer.getByRole("combobox", { name: "Affected entity *" }).fill("revolut");
    const hit = page.getByRole("option", { name: /Revolut Ltd/ });
    await expect(hit).toContainText("Customer");
    await expect(hit).toContainText("GB");
    await hit.click();
    await expect(drawer.getByTestId("picked-entity")).toHaveText("Revolut Ltd");

    await drawer.getByRole("combobox", { name: "Type" }).click();
    await page.getByRole("option", { name: "Wrong match result" }).click();
    // Product line lists only this entity's lines, and "No specific product line" at the end.
    await drawer.getByRole("combobox", { name: "Product line" }).click();
    const options = await page.getByRole("option").allInnerTexts();
    expect(options.filter((o) => /UK CoP \/ GB|Global validation \/ SG|EU VoP \/ DE/.test(o))).toHaveLength(3);
    expect(options[options.length - 1]).toBe("No specific product line");
    await page.getByRole("option", { name: /UK CoP \/ GB/ }).click();
    // Picking a line fills Scheme and Country, read-only, with a Change link.
    await expect(drawer.getByTestId("product-line-summary")).toContainText("UK CoP / GB");
    await expect(drawer.getByRole("textbox", { name: "Scheme" })).toHaveValue("UK CoP");
    await expect(drawer.getByRole("textbox", { name: "Scheme" })).toHaveAttribute("readonly", "");
    await expect(drawer.getByRole("textbox", { name: "Country" })).toHaveValue("GB, United Kingdom");
    // The "Open issues on <entity>, <scheme> <country>" box works from the resolved scheme and country.
    await expect(drawer.getByText("Open issues on Revolut Ltd, UK CoP GB")).toBeVisible();
    await expect(drawer.getByText("ISS-1038")).toBeVisible();

    await fillTheRest(drawer, page, "Trade-name payees return No match since this morning.");
    await drawer.getByRole("button", { name: "Report issue" }).click();
    await expect(page).toHaveURL(/\/issues\/.+\?reported=1/);
    const issue = await db.issue.findUniqueOrThrow({ where: { id: page.url().match(/\/issues\/([^/?]+)/)![1] }, include: { entity: true } });
    expect(issue.entity.legalName).toBe("Revolut Ltd");
    expect([issue.scheme, issue.country]).toEqual(["UK_COP", "GB"]);
    expect(issue.productId).not.toBeNull();
    expect(issue.reporterId).toBe((await db.user.findUniqueOrThrow({ where: { email: EMMA } })).id);
  });

  test("as Lukas Brenner: a partner report on Lloyds Bank plc lists its coverages with their status; pick UK CoP / GB, no scheme or country to type", async ({ page }) => {
    await signInAs(page, EMAIL.lukas);
    const drawer = await openFromHome(page);
    await drawer.getByRole("combobox", { name: "Affected entity *" }).fill("lloyds");
    await expect(page.getByRole("option", { name: /Lloyds Bank plc/ })).toContainText("Both");
    await pickEntity(page, drawer, "lloyds", "Lloyds Bank plc");

    await drawer.getByRole("combobox", { name: "Type" }).click();
    await page.getByRole("option", { name: "Partner degraded or unavailable" }).click();
    // No Product line; "Partner coverage affected *" lists the partner's coverages (its Partner tab) with their status. Lloyds has three, so none is preselected.
    await expect(drawer.getByRole("combobox", { name: "Product line" })).toHaveCount(0);
    const group = drawer.getByRole("radiogroup", { name: "Partner coverage affected" });
    await expect(group).toContainText("Partner coverage affected *");
    await expect(group.getByRole("radio")).toHaveCount(3);
    await expect(group.getByRole("radio", { checked: true })).toHaveCount(0);
    await expect(group.getByRole("radio", { name: /UK CoP \/ GB/ })).toBeVisible();
    await expect(group).toContainText("Active");
    await expect(group).toContainText("Onboarding");
    await group.getByRole("radio", { name: /UK CoP \/ GB/ }).check();
    await expect(drawer.getByRole("combobox", { name: "Scheme" })).toHaveCount(0);
    await expect(drawer.getByRole("combobox", { name: "Country" })).toHaveCount(0);

    await fillTheRest(drawer, page, "Lloyds CoP responses above 2 seconds and timeouts.");
    await drawer.getByRole("button", { name: "Report issue" }).click();
    await expect(page).toHaveURL(/\/issues\/.+\?reported=1/);
    const issue = await db.issue.findUniqueOrThrow({ where: { id: page.url().match(/\/issues\/([^/?]+)/)![1] }, include: { entity: true } });
    expect(issue.entity.legalName).toBe("Lloyds Bank plc");
    expect([issue.type, issue.scheme, issue.country, issue.productId]).toEqual(["PARTNER_DEGRADED", "UK_COP", "GB", null]);
  });

  test("before a coverage (or a product line) is picked, the open issues box says to pick one; after it, it checks", async ({ page }) => {
    await signInAs(page, EMAIL.lukas);
    const drawer = await openFromHome(page);
    await pickEntity(page, drawer, "lloyds", "Lloyds Bank plc");
    await drawer.getByRole("combobox", { name: "Type" }).click();
    await page.getByRole("option", { name: "Partner degraded or unavailable" }).click();
    await expect(drawer.getByTestId("open-issues-pick")).toHaveText("Pick a coverage to check for open issues on it");
    await expect(drawer.getByText("No open issues on this entity for this scheme and country")).toHaveCount(0);
    await drawer.getByRole("radio", { name: /UK CoP \/ GB/ }).check();
    await expect(drawer.getByTestId("open-issues-pick")).toHaveCount(0);
    await expect(drawer.getByText("Open issues on Lloyds Bank plc, UK CoP GB")).toBeVisible();

    // A customer type: the same before a product line is picked.
    await drawer.getByRole("button", { name: "Change" }).first().click();
    await pickEntity(page, drawer, "revolut", "Revolut Ltd");
    await drawer.getByRole("combobox", { name: "Type" }).click();
    await page.getByRole("option", { name: "Wrong match result" }).click();
    await expect(drawer.getByTestId("open-issues-pick")).toHaveText("Pick a product line to check for open issues on it");
    await drawer.getByRole("combobox", { name: "Product line" }).click();
    await page.getByRole("option", { name: /UK CoP \/ GB/ }).click();
    await expect(drawer.getByTestId("open-issues-pick")).toHaveCount(0);
    await expect(drawer.getByText("Open issues on Revolut Ltd, UK CoP GB")).toBeVisible();
  });

  test("a partner with one coverage has it preselected (ING-DiBa AG: EU VoP / DE)", async ({ page }) => {
    await signInAs(page, EMAIL.lukas);
    const drawer = await openFromHome(page);
    await pickEntity(page, drawer, "ing-diba", "ING-DiBa AG");
    await drawer.getByRole("combobox", { name: "Type" }).click();
    await page.getByRole("option", { name: "Partner degraded or unavailable" }).click();
    const group = drawer.getByRole("radiogroup", { name: "Partner coverage affected" });
    await expect(group.getByRole("radio")).toHaveCount(1);
    await expect(group.getByRole("radio", { name: /EU VoP \/ DE/ })).toBeChecked();
    await expect(drawer.getByRole("combobox", { name: "Scheme" })).toHaveCount(0);
    await fillTheRest(drawer, page, "ING-DiBa EU VoP responses time out for every request.");
    await drawer.getByRole("button", { name: "Report issue" }).click();
    await expect(page).toHaveURL(/\/issues\/.+\?reported=1/);
    const issue = await db.issue.findUniqueOrThrow({ where: { id: page.url().match(/\/issues\/([^/?]+)/)![1] } });
    expect([issue.scheme, issue.country]).toEqual(["EU_VOP", "DE"]);
  });

  test("'Other scheme or country' opens the fallback fields; the lists start with Suggested (the entity's own), then all others A to Z, and filter as you type", async ({ page }) => {
    await signInAs(page, EMAIL.lukas);
    const drawer = await openFromHome(page);
    await pickEntity(page, drawer, "lloyds", "Lloyds Bank plc");
    await drawer.getByRole("combobox", { name: "Type" }).click();
    await page.getByRole("option", { name: "Partner degraded or unavailable" }).click();
    await drawer.getByRole("button", { name: "Other scheme or country" }).click();

    const scheme = drawer.getByRole("combobox", { name: "Scheme" });
    await scheme.click();
    const schemeList = page.getByRole("listbox", { name: "Scheme" });
    await expect(schemeList.getByRole("group", { name: "Suggested" }).getByRole("option")).toHaveText(["UK CoP", "Global validation"]); // the partner's own schemes first
    await expect(schemeList.getByRole("group", { name: "All others" }).getByRole("option")).toHaveText(["EU VoP"]);
    await schemeList.getByRole("option", { name: "UK CoP" }).click();

    const country = drawer.getByRole("combobox", { name: "Country" });
    await country.click();
    const countryList = page.getByRole("listbox", { name: "Country" });
    await expect(countryList.getByRole("group", { name: "Suggested" }).getByRole("option").first()).toContainText("GB");
    const others = await countryList.getByRole("group", { name: "All others" }).getByRole("option").allInnerTexts();
    expect(others).toEqual([...others].sort((a, b) => a.localeCompare(b))); // A to Z
    await country.fill("austri");
    await expect(countryList.getByRole("option")).toHaveCount(1);
    await expect(countryList.getByRole("option")).toContainText("AT");
    await countryList.getByRole("option").click();
    await expect(country).toHaveValue(/^AT/);
    // And back to the partner's own coverage.
    await drawer.getByRole("button", { name: "Choose from the partner's coverage" }).click();
    await expect(drawer.getByRole("radio", { name: /UK CoP \/ GB/ })).toBeVisible();
  });

  test("'No specific product line' (for example billing) opens Scheme and Country, with the entity's own country in Suggested first", async ({ page }) => {
    await signInAs(page, EMMA);
    const drawer = await openFromHome(page);
    await pickEntity(page, drawer, "revolut", "Revolut Ltd");
    await drawer.getByRole("combobox", { name: "Type" }).click();
    await page.getByRole("option", { name: "Billing" }).click();
    await drawer.getByRole("combobox", { name: "Product line" }).click();
    await page.getByRole("option", { name: "No specific product line" }).click();
    await expect(drawer.getByText("For issues not tied to one product, for example billing")).toBeVisible();
    await drawer.getByRole("combobox", { name: "Country" }).click();
    const suggested = page.getByRole("listbox", { name: "Country" }).getByRole("group", { name: "Suggested" }).getByRole("option");
    // Revolut's own countries (its product lines: DE, SG, GB; registered country GB) come first, in their own group, ahead of "All others".
    expect((await suggested.allInnerTexts()).map((t) => t.slice(0, 2)).sort()).toEqual(["DE", "GB", "SG"]);
    const groups = await page.getByRole("listbox", { name: "Country" }).getByRole("group").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
    expect(groups).toEqual(["Suggested", "All others"]);
  });

  test("changing the entity clears what depends on it (product line, scheme and country, reported at the customer by, open issues) and keeps the rest", async ({ page }) => {
    await signInAs(page, EMMA);
    const drawer = await openFromHome(page);
    await pickEntity(page, drawer, "revolut", "Revolut Ltd");
    await drawer.getByRole("combobox", { name: "Type" }).click();
    await page.getByRole("option", { name: "Wrong match result" }).click();
    await drawer.getByRole("combobox", { name: "Product line" }).click();
    await page.getByRole("option", { name: /UK CoP \/ GB/ }).click();
    await drawer.getByLabel("Description").fill("A description that stays when the entity changes.");
    await drawer.getByRole("combobox", { name: "Reported at the customer by" }).click();
    await page.getByRole("option", { name: "Someone else" }).click();
    await drawer.getByLabel("Name of the person").fill("Priya");
    await drawer.getByRole("radio", { name: "Degraded" }).check();
    await expect(drawer.getByText("Open issues on Revolut Ltd, UK CoP GB")).toBeVisible();

    await drawer.getByRole("button", { name: "Change" }).first().click(); // next to the picked entity
    await expect(drawer.getByTestId("picked-entity")).toHaveCount(0);
    await pickEntity(page, drawer, "santander", "Santander UK plc");
    await expect(drawer.getByText("Open issues on Santander UK plc")).toBeVisible();
    await expect(drawer.getByTestId("product-line-summary")).toHaveCount(0); // the product line is cleared (Santander has its own)
    await expect(drawer.getByLabel("Name of the person")).toHaveCount(0); // reported at the customer by is cleared
    await expect(drawer.getByRole("combobox", { name: "Reported at the customer by" })).toContainText("Select");
    // The rest stays.
    await expect(drawer.getByLabel("Description")).toHaveValue("A description that stays when the entity changes.");
    await expect(drawer.getByRole("radio", { name: "Degraded" })).toBeChecked();
    await expect(drawer.getByRole("combobox", { name: "Type" })).toContainText("Wrong match result");
  });

  test("keyboard: Escape closes the drawer", async ({ page }) => {
    await signInAs(page, EMMA);
    const drawer = await openFromHome(page);
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(page.getByRole("button", { name: "Report issue" })).toBeFocused(); // focus returns to the button
  });

  test("1024 px: the button stays in the header row and the drawer keeps its width", async ({ page }) => {
    await signInAs(page, EMMA);
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto("/");
    const button = page.getByRole("button", { name: "Report issue" });
    const title = await page.getByRole("heading", { name: "My worklist" }).boundingBox();
    const box = await button.boundingBox();
    expect(Math.abs(box!.y + box!.height / 2 - (title!.y + title!.height / 2))).toBeLessThan(60);
    await button.click();
    const drawer = page.getByRole("dialog", { name: "Report issue" });
    const width = (await drawer.boundingBox())!.width;
    expect(width).toBeLessThanOrEqual(640);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
