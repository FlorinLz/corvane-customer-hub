import "dotenv/config";

import path from "node:path";

import { expect, test } from "@playwright/test";

import { signUserCookie, SESSION_COOKIE } from "@/server/session";
import { db } from "@/server/db";
import { resetDemoData } from "./fixtures/reset";

/**
 * Fuller Home worklists: Home as Emma Wilson, Adrian Koh and Lukas Brenner at 1440 px right after Reset, at the demo start
 * (Mon 05 Oct 2026, 10:05 CEST, the `issues` project's clock). Runs only with SHOTS_DIR set. The fourth screenshot (Adrian after the
 * partner scenario) is taken by scenario5-issue-flow-short.spec.ts.
 */

const DIR = process.env.SHOTS_DIR;
test.skip(!DIR, "SHOTS_DIR not set");

test("Home as Emma, Adrian and Lukas right after Reset", async ({ page, request, context }) => {
  test.setTimeout(240_000);
  await resetDemoData(request);
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const [name, email, chip] of [
    ["emma", "emma.wilson@corvane.example", "Issues (6)"],
    ["adrian", "adrian.koh@corvane.example", "Issues (6)"],
    ["lukas", "lukas.brenner@corvane.example", "Issues (4)"],
  ] as const) {
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    await context.addCookies([{ name: SESSION_COOKIE, value: signUserCookie(user.id), url: "http://localhost:3101" }]);
    await page.goto("/");
    await expect(page.getByRole("region", { name: "Issues" }).getByText(chip)).toBeVisible();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(DIR!, `home-${name}-1440.png`), fullPage: true });
  }
});
