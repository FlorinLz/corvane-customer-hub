import "dotenv/config";

import { expect, test } from "@playwright/test";

import { signUserCookie, SESSION_COOKIE } from "@/server/session";
import { db } from "@/server/db";

// Brief 5.2 "Access and record pages": exact copy for the 403 states.
// The default demo user is the admin: /admin/users lists the users for them. Everyone else gets the 403
// copy on all three admin routes (tested here as Tom Hadley, Sales: neither admin nor Compliance).
test("Admin routes show the exact 'No access to Admin' copy", async ({ page, context }) => {
  await page.goto("/admin/users");
  await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
  await expect(page.getByTestId("admin-users-table").getByText("Adrian Koh")).toBeVisible();
  await expect(page.getByText("You don't have access to Admin")).toHaveCount(0);

  const tom = await db.user.findUniqueOrThrow({ where: { email: "tom.hadley@corvane.example" } });
  await context.addCookies([
    { name: SESSION_COOKIE, value: signUserCookie(tom.id), url: "http://localhost:3000" },
  ]);
  for (const path of ["/admin/users", "/admin/deleted-records", "/admin/roles-permissions"]) {
    await page.goto(path);
    await expect(page.getByText("You don't have access to Admin. Ask Adrian Koh (Ops).")).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to Home", exact: true })).toBeVisible();
  }
});

test("/customers/new shows the exact wizard-not-allowed copy", async ({ page }) => {
  await page.goto("/customers/new");
  await expect(page.getByText("Only Sales can create a customer record")).toBeVisible();
  await expect(page.getByRole("link", { name: "Go to search" })).toBeVisible();
});
