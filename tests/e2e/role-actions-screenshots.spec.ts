import "dotenv/config";

import path from "node:path";

import { expect, test } from "@playwright/test";

import { db } from "@/server/db";

import { createLinkedIssueFixture, EMAIL, signInAs, type LinkedIssueFixture } from "./fixtures/role-actions-setup";

/**
 * Role actions PR: Home (Adrian Koh, Kevin Lim) and a linked issue page (Adrian Koh, Lukas Brenner) at 1440
 * and 1024 px. Runs only with SHOTS_DIR set (it writes PNGs there, "before-" or "after-" prefixed by SHOTS_PREFIX);
 * the same file runs against main for the "before" set and against this branch for the "after" set.
 */

const DIR = process.env.SHOTS_DIR;
const PREFIX = process.env.SHOTS_PREFIX ?? "after";

test.skip(!DIR, "SHOTS_DIR not set");
test.describe.configure({ mode: "serial" });

let fx: LinkedIssueFixture;

test("screenshots", async ({ page, request, context }) => {
  test.setTimeout(300_000);
  await context.route("https://mail.google.com/**", (r) => r.fulfill({ body: "ok" }));
  fx = await createLinkedIssueFixture(page, request);

  const mps = await db.issue.findFirstOrThrow({ where: { number: 1042 } }); // Banca Monte dei Paschi di Siena: acknowledged, notified and assessed in the seed
  const shots: [string, string, string][] = [
    ["home-adrian", EMAIL.adrian, "/"],
    ["home-kevin", EMAIL.kevin, "/"],
    ["issue-adrian", EMAIL.adrian, `/issues/${fx.childId}`],
    ["issue-lukas", EMAIL.lukas, `/issues/${fx.childId}`],
    ["issue-mps-kevin", EMAIL.kevin, `/issues/${mps.id}`],
  ];
  for (const width of [1440, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [name, email, url] of shots) {
      await signInAs(page, email);
      await page.goto(url);
      if (url === "/") await expect(page.getByRole("heading", { name: /^Issues/ })).toBeVisible();
      else await expect(page.getByRole("heading", { name: /^People$/ })).toBeVisible();
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(DIR!, `${PREFIX}-${name}-${width}.png`), fullPage: true });
    }
  }
});
