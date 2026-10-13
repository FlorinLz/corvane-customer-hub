import "dotenv/config";

import { expect, test } from "@playwright/test";

import { createLinkedIssueFixture, EMAIL, resolvePartnerWithCascade, signInAs } from "./fixtures/role-actions-setup";

/**
 * Compliance can assess a resolved issue: Lukas resolves the partner issue (the cascade resolves Revolut's linked issue), then Mei Chen
 * records her assessment on the Revolut linked issue. The step is open, the button is offered, the server accepts it, and the Done line appears.
 */

test("Mei Chen records the assessment on the Revolut linked issue after the cascade resolved it", async ({ page, request, context }) => {
  test.setTimeout(240_000);
  await context.route("https://mail.google.com/**", (r) => r.fulfill({ body: "ok" }));
  const fx = await createLinkedIssueFixture(page, request);
  await resolvePartnerWithCascade(page, fx);

  await signInAs(page, EMAIL.mei);
  await page.goto(`/issues/${fx.childId}`);
  const plan = page.getByRole("region", { name: "Action plan" });
  await expect(plan.getByTestId("plan-row-assess")).toBeVisible();
  await expect(plan.getByTestId("plan-row-assess")).toContainText("Mei Chen");

  await page.getByRole("region", { name: "Compliance" }).getByRole("button", { name: "Record assessment" }).click();
  const dialog = page.getByRole("dialog", { name: "Record assessment" });
  await dialog.getByRole("radio", { name: "Possible major incident" }).check();
  await dialog.getByLabel("Rationale").fill("Material CoP outage for a UK FCA customer, assessed after the quick resolution.");
  await dialog.getByRole("button", { name: "Save assessment" }).click();
  await expect(page.getByText(/Possible major incident\. Assessed by Mei Chen \(Compliance\)/)).toBeVisible();
  await expect(page.getByText("This issue is closed")).toHaveCount(0);

  await page.goto(`/issues/${fx.childId}`);
  await expect(plan.getByTestId("plan-row-assess")).toHaveCount(0);
  await expect(page.getByTestId("plan-done")).toContainText(/Done: Assessed for Compliance by Mei Chen/);
});
