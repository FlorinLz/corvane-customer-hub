import "dotenv/config";

import path from "node:path";

import { expect, test } from "@playwright/test";

import { db } from "@/server/db";

import { approveRootCauseReport, createLinkedIssueFixture, EMAIL, resolvePartnerWithCascade, signInAs } from "./fixtures/role-actions-setup";

/**
 * Report from Home (the button, the drawer with the entity field, the partner coverage and product line choices) at 1440 and 1024 px, and the four
 * stage templates of the message to the customer at 1440 px. Runs only with SHOTS_DIR set (it writes PNGs there).
 */

const DIR = process.env.SHOTS_DIR;
test.skip(!DIR, "SHOTS_DIR not set");

test("report from home screenshots", async ({ page, request, context }) => {
  test.setTimeout(420_000);
  await context.route("https://mail.google.com/**", (r) => r.fulfill({ body: "ok" }));
  const fx = await createLinkedIssueFixture(page, request); // the partner issue ISS-1043 (First notification) and its linked Revolut issue
  const out = (name: string, width: number) => path.join(DIR!, `${name}${width === 1024 ? "-1024" : ""}.png`);

  // Home with the button, and the drawer with the entity field.
  for (const width of [1440, 1024]) {
    await signInAs(page, "emma.wilson@corvane.example");
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Report issue" })).toBeVisible();
    await page.waitForTimeout(400);
    await page.screenshot({ path: out("Home-Report-Issue-Button", width) });
    await page.getByRole("button", { name: "Report issue" }).click();
    const drawer = page.getByRole("dialog", { name: "Report issue" });
    await expect(drawer.getByRole("combobox", { name: "Affected entity *" })).toBeFocused();
    await page.waitForTimeout(300);
    await page.screenshot({ path: out("Report-Drawer-Entity-Field", width) });
    await drawer.getByRole("combobox", { name: "Affected entity *" }).fill("lloyds");
    await expect(page.getByRole("option", { name: /Lloyds Bank plc/ })).toBeVisible();
    await page.screenshot({ path: out("Report-Drawer-Entity-Results", width) });
    await page.getByRole("option", { name: /Lloyds Bank plc/ }).click();
    await drawer.getByRole("combobox", { name: "Type" }).click();
    await page.getByRole("option", { name: "Partner degraded or unavailable" }).click();
    await expect(drawer.getByRole("radiogroup", { name: "Partner coverage affected" })).toBeVisible();
    await page.waitForTimeout(300);
    await page.screenshot({ path: out("Report-Drawer-Partner-Coverage", width) });
    await drawer.getByRole("button", { name: "Other scheme or country" }).click();
    await drawer.getByRole("combobox", { name: "Country" }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: out("Report-Drawer-Other-Country-Suggested", width) });
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    // A customer: the product lines of this entity only.
    await page.goto("/");
    await page.getByRole("button", { name: "Report issue" }).click();
    await drawer.getByRole("combobox", { name: "Affected entity *" }).fill("revolut");
    await page.getByRole("option", { name: /Revolut Ltd/ }).click();
    await drawer.getByRole("combobox", { name: "Type" }).click();
    await page.getByRole("option", { name: "Billing" }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: out("Report-Drawer-Open-Issues-Pick-Product-Line", width) });
    await drawer.getByRole("combobox", { name: "Product line" }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: out("Report-Drawer-Product-Lines", width) });
    await page.keyboard.press("Escape");
  }

  // The four templates (1440 px).
  await page.setViewportSize({ width: 1440, height: 900 });
  const panelShot = async (name: string, email: string, issueId: string) => {
    await signInAs(page, email);
    await page.goto(`/issues/${issueId}`);
    const panel = page.getByRole("region", { name: "Message to the customer" });
    await expect(panel).toBeVisible();
    await page.waitForTimeout(300);
    await panel.screenshot({ path: path.join(DIR!, `${name}.png`) });
  };
  await panelShot("Message-1-First-notification", EMAIL.adrian, fx.childId);
  await db.issue.update({ where: { id: fx.childId }, data: { notifiedAt: new Date(), version: { increment: 1 } } });
  await panelShot("Message-2-Update", EMAIL.adrian, fx.childId);
  await signInAs(page, EMAIL.lukas);
  await resolvePartnerWithCascade(page, fx);
  await panelShot("Message-3-Resolution", EMAIL.adrian, fx.childId);
  await approveRootCauseReport(request, fx.childId);
  await panelShot("Message-4-Root-cause-report", EMAIL.lukas, fx.childId);
});
