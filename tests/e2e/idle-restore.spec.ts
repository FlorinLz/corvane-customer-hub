import "dotenv/config";

import { expect, test } from "@playwright/test";

import { signUserCookie, SESSION_COOKIE } from "@/server/session";
import { db } from "@/server/db";

/**
 * The portfolio runtime: no public reset, the demo bar's sentence, the cron backstop's door, and the Home chip against the Issues table.
 * Read-only against the shared e2e database (nothing here writes data).
 */

async function asAdrian() {
  const adrian = await db.user.findUniqueOrThrow({ where: { email: "adrian.koh@corvane.example" } });
  return { cookie: `${SESSION_COOKIE}=${signUserCookie(adrian.id)}`, adrian };
}

test("/api/demo/reset answers 404, to the admin too", async ({ request }) => {
  const { cookie } = await asAdrian();
  expect((await request.post("/api/demo/reset", { headers: { cookie } })).status()).toBe(404);
  expect((await request.get("/api/demo/reset", { headers: { cookie } })).status()).toBe(404);
});

test("/api/cron/demo-restore answers 401 without the secret", async ({ request }) => {
  expect((await request.get("/api/cron/demo-restore")).status()).toBe(401);
  expect((await request.get("/api/cron/demo-restore", { headers: { authorization: "Bearer not-the-secret" } })).status()).toBe(401);
});

test("the Admin menu and the Admin sidebar have no Reset demo data", async ({ page, context }) => {
  const { adrian } = await asAdrian();
  await context.addCookies([{ name: SESSION_COOKIE, value: signUserCookie(adrian.id), domain: "localhost", path: "/" }]);
  await page.goto("/");
  await page.getByRole("button", { name: "Admin", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: "Deleted records" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Roles & permissions" })).toBeVisible();
  await expect(page.getByText("Reset demo data")).toHaveCount(0);
  await page.keyboard.press("Escape");

  await page.goto("/admin/roles-permissions");
  await expect(page.getByRole("navigation", { name: "Admin" })).toBeVisible();
  await expect(page.getByText("Reset demo data")).toHaveCount(0);
});

test("the demo bar says the demo resets after 20 minutes without changes", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Demo with fictional data. Bank names are illustrative; the incidents are invented. The demo resets after 20 minutes without changes.")).toBeVisible();
});

test("Home: the Issues chip shows the same number as the Issues table, and My team says it is the team's", async ({ page, context }) => {
  const { adrian } = await asAdrian();
  await context.addCookies([{ name: SESSION_COOKIE, value: signUserCookie(adrian.id), domain: "localhost", path: "/" }]);
  await page.goto("/");

  const chip = page.locator('a[href="#worklist-issues"]');
  const chipCount = Number((await chip.innerText()).match(/Issues\s+(\d+)/)![1]);
  const heading = page.getByRole("heading", { name: /^Issues \(\d+\)$/ });
  await expect(heading).toBeVisible();
  expect(Number((await heading.innerText()).match(/\((\d+)\)/)![1])).toBe(chipCount);

  // The chip is always "Mine". The table can show the team, and then the heading says so instead of reading like a contradiction.
  await page.getByRole("button", { name: "My team" }).click();
  await expect(page.getByRole("heading", { name: /^Team issues \(\d+\)$/ })).toBeVisible();
  await expect(chip).toHaveText(new RegExp(`^Issues\\s+${chipCount}`));
});

test.describe("the idle restore", () => {
  test.describe.configure({ mode: "serial" });

  const idleFor = (minutes: number) =>
    db.$executeRaw`UPDATE "DemoMeta" SET "lastWriteAt" = clock_timestamp() - make_interval(mins => ${minutes}::int) WHERE "id" = 1`;
  const arrivalOf = async (context: import("@playwright/test").BrowserContext) =>
    Number((await context.cookies()).find((c) => c.name === "ch_arrival")?.value);

  test("19 minutes without a write: the page renders at once and the data is left alone", async ({ page }) => {
    await idleFor(19);
    await page.goto("/");
    await expect(page.getByText("Preparing a fresh demo...")).toHaveCount(0);
    await expect(page.getByText("Demo mode")).toBeVisible();
    expect((await db.demoMeta.findUniqueOrThrow({ where: { id: 1 } })).lastWriteAt).not.toBeNull();
  });

  test("21 minutes without a write: Preparing a fresh demo..., then the page; the visitor's clock starts with the data", async ({ page, context, browser }) => {
    test.setTimeout(180_000);
    // A visitor who is already on the demo before the restore.
    const earlier = await browser.newContext();
    await (await earlier.newPage()).goto("/");
    const earlierArrival = await arrivalOf(earlier);
    expect(earlierArrival).toBeGreaterThan(0);

    await idleFor(21);
    const versionBefore = (await db.demoMeta.findUniqueOrThrow({ where: { id: 1 } })).seedVersion;
    await page.goto("/");
    await expect(page.getByText("Demo mode")).toBeVisible({ timeout: 120_000 }); // past the Preparing screen
    const meta = await db.demoMeta.findUniqueOrThrow({ where: { id: 1 } });
    expect(meta.seedVersion).toBe(versionBefore + 1);
    expect(meta.lastWriteAt).toBeNull();

    // The visitor who triggered it got a ch_arrival at or after the restore.
    expect(await arrivalOf(context)).toBeGreaterThanOrEqual(meta.lastRestoreAt!.getTime());

    // The visitor who was already there arrived before the restore: their next page load gets a new clock, with no second restore.
    const next = await earlier.newPage();
    await next.goto("/");
    await expect(next.getByText("Demo mode")).toBeVisible({ timeout: 60_000 });
    expect(await arrivalOf(earlier)).toBeGreaterThanOrEqual(meta.lastRestoreAt!.getTime());
    expect((await db.demoMeta.findUniqueOrThrow({ where: { id: 1 } })).seedVersion).toBe(versionBefore + 1);
    await earlier.close();
  });
});
