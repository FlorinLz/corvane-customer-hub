import "dotenv/config";

import path from "node:path";

import { expect, test } from "@playwright/test";

import { db } from "@/server/db";
import { signUserCookie, SESSION_COOKIE } from "@/server/session";

import { createLinkedIssueFixture, EMAIL, resolvePartnerWithCascade, signInAs } from "./fixtures/role-actions-setup";

/**
 * Action plan in process order: the plan of ISS-1042 (MPS, resolved by Kevin) and of the Revolut linked issue (ISS-1046, resolved
 * through the cascade) at 1440 px. Runs only with SHOTS_DIR set.
 */

const DIR = process.env.SHOTS_DIR;
test.skip(!DIR, "SHOTS_DIR not set");

test("action plan screenshots", async ({ page, request, context }) => {
  test.setTimeout(300_000);
  await context.route("https://mail.google.com/**", (r) => r.fulfill({ body: "ok" }));
  const fx = await createLinkedIssueFixture(page, request);
  await resolvePartnerWithCascade(page, fx);

  const mps = await db.issue.findFirstOrThrow({ where: { number: 1042 } });
  const kevin = await db.user.findUniqueOrThrow({ where: { email: EMAIL.kevin } });
  const res = await request.post(`/api/issues/${mps.id}/resolve`, {
    headers: { cookie: `${SESSION_COOKIE}=${signUserCookie(kevin.id)}` },
    data: { rootCause: "The endpoint certificate expired after the rotation job failed.", solution: "Certificate renewed and the rotation job fixed.", version: mps.version },
  });
  expect(res.ok()).toBe(true);

  await page.setViewportSize({ width: 1440, height: 900 });
  for (const [name, email, id] of [
    ["action-plan-ISS-1042-emma", "emma.wilson@corvane.example", mps.id],
    ["action-plan-ISS-1042-kevin", EMAIL.kevin, mps.id],
    ["action-plan-ISS-1046-adrian", EMAIL.adrian, fx.childId],
    ["action-plan-ISS-1046-mei", EMAIL.mei, fx.childId],
  ] as const) {
    await signInAs(page, email);
    await page.goto(`/issues/${id}`);
    await expect(page.getByRole("region", { name: "Action plan" })).toBeVisible();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(DIR!, `${name}-1440.png`), fullPage: true });
  }
});
