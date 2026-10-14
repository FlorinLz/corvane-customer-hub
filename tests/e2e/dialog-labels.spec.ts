import "dotenv/config";

import { expect, test, type Page } from "@playwright/test";

import { db } from "@/server/db";
import { resetDemoData } from "./fixtures/reset";

/**
 * Every dialog/drawer built in milestones 4-5 must expose an accessible
 * name for every form control it contains — found as a real defect
 * (ChangeCoverageStatusDialog's Reason textarea) during milestone 5's
 * e2e verification. This opens each one and asserts no field is left
 * unlabelled, so the class of bug can't silently reappear.
 */

test.describe.configure({ mode: "serial" });

/** Brief 7.3.2: "Helper viewAs(team) uses the switcher in the demo strip." */
async function viewAs(page: Page, optionLabel: string) {
  await page.getByRole("combobox", { name: "View as" }).click();
  await page.getByRole("option", { name: optionLabel }).click();
  await expect(page.getByText("Now viewing as")).toBeVisible();
}

/**
 * Asserts every visible input/textarea/select-trigger/plain-text-button
 * inside `scopeLabel` (an open dialog or drawer, matched by its heading)
 * has an accessible name. `el.labels` covers both `htmlFor`/`id` pairing
 * and a control physically nested inside its `<label>`; `aria-label` /
 * `aria-labelledby` cover the rest. Buttons are checked by visible text
 * instead, since Radix's Select trigger is a `<button>`, not a native
 * `<select>`.
 */
async function assertAllFieldsLabelled(page: Page, scopeLabel: string | RegExp) {
  const scope = page.getByRole("dialog", { name: scopeLabel });
  await expect(scope).toBeVisible();

  const unlabelled = await scope.evaluate((root, scopeLabelStr) => {
    const problems: string[] = [];

    const fields = root.querySelectorAll("input, textarea, select");
    for (const el of Array.from(fields)) {
      const input = el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
      if (input.offsetParent === null && input.type !== "hidden") continue; // not visible
      if (input.type === "hidden") continue;
      const hasNativeLabel = "labels" in input && input.labels && input.labels.length > 0;
      const hasAriaLabel = input.getAttribute("aria-label");
      const hasAriaLabelledBy = input.getAttribute("aria-labelledby");
      if (!hasNativeLabel && !hasAriaLabel && !hasAriaLabelledBy) {
        problems.push(
          `${scopeLabelStr}: <${input.tagName.toLowerCase()}${input.getAttribute("type") ? ` type="${input.getAttribute("type")}"` : ""}> ` +
            `(name="${input.getAttribute("name") ?? ""}", placeholder="${input.getAttribute("placeholder") ?? ""}", id="${input.id}") has no accessible name`,
        );
      }
    }

    const buttons = root.querySelectorAll("button");
    for (const el of Array.from(buttons)) {
      const button = el as HTMLButtonElement;
      if (button.offsetParent === null) continue;
      const text = (button.textContent ?? "").trim();
      const hasAriaLabel = button.getAttribute("aria-label");
      if (!text && !hasAriaLabel) {
        problems.push(`${scopeLabelStr}: <button> (id="${button.id}", class="${button.className}") has no accessible name`);
      }
    }

    return problems;
  }, String(scopeLabel));

  expect(unlabelled, `Unlabelled form controls found:\n${unlabelled.join("\n")}`).toEqual([]);
}

test.beforeEach(async ({ request }) => {
  test.setTimeout(180_000); // first hit on a cold Turbopack dev server compiles every route it touches
  await resetDemoData(request);
});

test("every dialog and drawer has an accessible name on every form field", async ({ page }) => {
  // ───────────── Admin: Delete record (milestone 4) ─────────────
  // resetDemoData forges the session cookie as Adrian Koh (Ops, Admin)
  // directly, so no viewAs() is needed to reach this team.
  await page.goto("/");

  const anyEntity = await db.entity.findFirstOrThrow({ where: { deletedAt: null } });
  await page.goto(`/entities/${anyEntity.id}/overview`);
  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Delete record" }).click();
  await assertAllFieldsLabelled(page, /Delete/);
  await page.keyboard.press("Escape");

  // ───────────── Details tab (Ops): Edit roles, Attach contract, Link entity ─────────────
  const standaloneNoContract = await db.entity.findFirstOrThrow({
    where: { deletedAt: null, groupId: null, customerRole: { active: true, contractId: null } },
  });
  await page.goto(`/entities/${standaloneNoContract.id}/details`);

  await page.getByRole("button", { name: "Edit roles" }).click();
  await assertAllFieldsLabelled(page, "Edit roles");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Attach contract" }).click();
  await assertAllFieldsLabelled(page, "Attach contract");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Link entity" }).click();
  await assertAllFieldsLabelled(page, "Link entity");
  await page.keyboard.press("Escape");

  // ───────────── Details tab (CS): Edit renewal date ─────────────
  const withCustomerRole = await db.entity.findFirstOrThrow({ where: { deletedAt: null, customerRole: { active: true } } });
  await viewAs(page, "Customer Success · Emma Wilson");
  await page.goto(`/entities/${withCustomerRole.id}/details`);
  await page.getByRole("button", { name: "Edit renewal date" }).click();
  await assertAllFieldsLabelled(page, "Edit renewal date");
  await page.keyboard.press("Escape");

  // ───────────── Owner: Reassign/Set owner (CS) ─────────────
  await page.getByRole("button", { name: /Reassign owner|Set owner/ }).click();
  await assertAllFieldsLabelled(page, /Reassign owner|Set owner/);
  await page.keyboard.press("Escape");

  // ───────────── Products tab (Ops): Change stage, Mark as blocked, Resolve block ─────────────
  await viewAs(page, "Ops · Adrian Koh Admin");
  const activeProduct = await db.contractedProduct.findFirstOrThrow({ where: { cancelledAt: null, blockedBy: null, stage: { not: "BAU" } } });
  await page.goto(`/entities/${activeProduct.entityId}/products`);

  await page.getByRole("button", { name: "Change stage" }).first().click();
  await assertAllFieldsLabelled(page, /Change stage/);
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Mark as blocked" }).first().click();
  await assertAllFieldsLabelled(page, /Mark as blocked/);
  await page.keyboard.press("Escape");

  const blockedProduct = await db.contractedProduct.findFirstOrThrow({ where: { blockedBy: { not: null } } });
  await page.goto(`/entities/${blockedProduct.entityId}/products`);
  await page.getByRole("button", { name: "Resolve block" }).first().click();
  await assertAllFieldsLabelled(page, /Resolve block/);
  await page.keyboard.press("Escape");

  // ───────────── Contacts tab: Add contact, Edit contact ─────────────
  await page.goto(`/entities/${anyEntity.id}/contacts`);
  await page.getByRole("button", { name: "Add contact" }).click();
  await assertAllFieldsLabelled(page, "Add contact");
  await page.keyboard.press("Escape");

  const ownedContact = await db.contact.findFirstOrThrow({ where: { context: "CUSTOMER", role: "TECHNICAL", status: "ACTIVE" } });
  await page.goto(`/entities/${ownedContact.entityId}/contacts`);
  await page.getByRole("button", { name: "Edit" }).first().click();
  await assertAllFieldsLabelled(page, "Edit contact");
  await page.keyboard.press("Escape");

  // ───────────── Partner tab (Network): Change status ─────────────
  await viewAs(page, "Network · Lukas Brenner");
  const coverage = await db.partnerCoverage.findFirstOrThrow();
  const coverageEntity = await db.partnerRole.findUniqueOrThrow({ where: { id: coverage.partnerRoleId } });
  await page.goto(`/entities/${coverageEntity.entityId}/partner`);
  await page.getByRole("button", { name: "Change status" }).first().click();
  await assertAllFieldsLabelled(page, /Change status/);
  await page.keyboard.press("Escape");

  // ───────────── Compliance tab (Compliance): Licence verification, Obligations edit ─────────────
  await viewAs(page, "Compliance · Mei Chen");
  await page.goto(`/entities/${anyEntity.id}/compliance`);
  await page.getByRole("button", { name: /Record verification|Update verification/ }).click();
  await assertAllFieldsLabelled(page, /verification: Licence/);
  await page.keyboard.press("Escape");

  const withCustomerRole2 = await db.entity.findFirstOrThrow({ where: { deletedAt: null, customerRole: { active: true } } });
  await page.goto(`/entities/${withCustomerRole2.id}/compliance`);
  const editObligations = page.getByRole("button", { name: "Edit" }).last();
  if (await editObligations.isVisible()) {
    await editObligations.click();
    const inputs = page.locator('input[id^="obligations-"], textarea[id^="obligations-"], select[id^="obligations-"], button[id^="obligations-"]');
    const count = await inputs.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const el = inputs.nth(i);
      const id = await el.getAttribute("id");
      const label = page.locator(`label[for="${id}"]`);
      await expect(label, `Obligations field #${id} has no associated label`).toHaveCount(1);
    }
    await page.getByRole("button", { name: "Cancel" }).click();
  }

  // ───────────── History tab: Add note ─────────────
  await page.goto(`/entities/${anyEntity.id}/history`);
  await page.getByRole("button", { name: "Add note" }).click();
  await assertAllFieldsLabelled(page, "Add note");

  // Add an action item row so its per-row fields (no visible individual
  // label, only aria-label) are actually present and checked too.
  await page.getByRole("button", { name: "+ Add action item" }).click();
  await assertAllFieldsLabelled(page, "Add note");
  await page.keyboard.press("Escape");
});
