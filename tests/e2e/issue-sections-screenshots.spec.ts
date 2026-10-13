import "dotenv/config";

import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { db } from "@/server/db";

import { approveRootCauseReport, createLinkedIssueFixture, shareRootCauseDraft, EMAIL, resolvePartnerWithCascade, signInAs } from "./fixtures/role-actions-setup";

/**
 * Action plan order, Compliance review and the issue page sections: the linked issue as Lukas, Adrian and Mei Chen right
 * after the resolution, after Compliance approved, and after the report was recorded; Home as Mei and as Lukas before the approval; the
 * Communication log and Internal notes cards; the Incident contact and About this issue blocks. 1440 and 1024 px, one PNG per page. Runs only with SHOTS_DIR set (it writes PNGs there).
 */

const DIR = process.env.SHOTS_DIR;
test.skip(!DIR, "SHOTS_DIR not set");

const MEI = EMAIL.mei;

test("sections screenshots", async ({ page, request, context }) => {
  test.setTimeout(420_000);
  await context.route("https://mail.google.com/**", (r) => r.fulfill({ body: "ok" }));
  const fx = await createLinkedIssueFixture(page, request);
  const iss1038 = await db.issue.findFirstOrThrow({ where: { number: 1038 } });
  const iss1042 = await db.issue.findFirstOrThrow({ where: { number: 1042 } });

  const out = (name: string, width: number) => path.join(DIR!, `${name}${width === 1024 ? "-1024" : ""}.png`);
  const page_ = async (name: string, email: string, url: string, ready: RegExp = /^Action plan$/) => {
    await signInAs(page, email);
    for (const width of [1440, 1024]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(url);
      await expect(page.getByRole("heading", { name: ready }).first()).toBeVisible();
      await page.waitForTimeout(500);
      await page.screenshot({ path: out(name, width), fullPage: true });
    }
  };
  const block = async (name: string, email: string, url: string, region: string, prepare?: (p: Page) => Promise<void>) => {
    await signInAs(page, email);
    for (const width of [1440, 1024]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(url);
      await expect(page.getByRole("region", { name: region })).toBeVisible();
      if (prepare) await prepare(page);
      await page.waitForTimeout(300);
      await page.getByRole("region", { name: region }).screenshot({ path: out(name, width) });
    }
  };

  // The design's own pages, to sit next to their renders.
  await page_("Issue-ISS-1038-Kevin", EMAIL.kevin, `/issues/${iss1038.id}`);
  await page_("Issue-ISS-1042-Emma", "emma.wilson@corvane.example", `/issues/${iss1042.id}`);
  await page_("Issue-ISS-1046-Adrian", EMAIL.adrian, `/issues/${fx.childId}`);

  // Right after the partner issue is resolved (before Compliance approves).
  await signInAs(page, EMAIL.lukas);
  await resolvePartnerWithCascade(page, fx);
  for (const [who, email] of [["Lukas", EMAIL.lukas], ["Adrian", EMAIL.adrian], ["Mei", MEI]] as const) {
    await page_(`Issue-ISS-1046-${who}-Resolved`, email, `/issues/${fx.childId}`);
  }
  await page_("Issue-ISS-1043-Partner-Lukas-Resolved", EMAIL.lukas, `/issues/${fx.parentId}`);
  await page_("Home-Table-Mei-BeforeDraft", MEI, "/", /^Issues/);
  await page_("Home-Table-Lukas-BeforeDraft", EMAIL.lukas, "/", /^Issues/);

  // The owner shared the draft: Compliance's turn.
  await shareRootCauseDraft(request, fx.childId);
  for (const [who, email] of [["Lukas", EMAIL.lukas], ["Adrian", EMAIL.adrian], ["Mei", MEI]] as const) {
    await page_(`Issue-ISS-1046-${who}-Drafted`, email, `/issues/${fx.childId}`);
  }
  await page_("Home-Table-Mei-BeforeApproval", MEI, "/", /^Issues/);
  await page_("Home-Table-Lukas-BeforeApproval", EMAIL.lukas, "/", /^Issues/);

  // After Compliance approved the Revolut report.
  await approveRootCauseReport(request, fx.childId);
  for (const [who, email] of [["Lukas", EMAIL.lukas], ["Adrian", EMAIL.adrian], ["Mei", MEI]] as const) {
    await page_(`Issue-ISS-1046-${who}-Approved`, email, `/issues/${fx.childId}`);
  }
  await page_("Home-Table-Lukas-AfterApproval", EMAIL.lukas, "/", /^Issues/);

  // After Lukas recorded the report.
  await signInAs(page, EMAIL.lukas);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/issues/${fx.childId}`);
  await page.getByRole("region", { name: "Your next action" }).getByRole("button", { name: "Record report sent" }).click();
  const dialog = page.getByRole("dialog", { name: "Record report sent" });
  await dialog.getByRole("combobox", { name: "Channel" }).click();
  await page.getByRole("option", { name: "Email" }).click();
  await dialog.getByLabel("Summary").fill("Cause: partner gateway overload. Impact: UK CoP checks timed out. Fix: configuration rollback and a new latency alert.");
  await dialog.getByRole("button", { name: "Record report sent" }).click();
  await expect(page.getByText("Report recorded")).toBeVisible();
  for (const [who, email] of [["Lukas", EMAIL.lukas], ["Adrian", EMAIL.adrian], ["Mei", MEI]] as const) {
    await page_(`Issue-ISS-1046-${who}-ReportSent`, email, `/issues/${fx.childId}`);
  }

  // The two cards.
  const emma = "emma.wilson@corvane.example";
  await block("Communication-log-card", emma, `/issues/${iss1042.id}`, "Communication log");
  await block("Internal-notes-card", emma, `/issues/${iss1042.id}`, "Internal notes");
  await block("Internal-notes-card-adding", emma, `/issues/${iss1042.id}`, "Internal notes", async (p) => {
    await p.getByRole("region", { name: "Internal notes" }).getByRole("button", { name: "Add note" }).click();
    await p.getByPlaceholder("New internal note").fill("Customer asked for a call back after 14:00 CEST.");
  });

  // The Incident contact and About this issue blocks.
  await block("Incident-contact-ISS-1038-Kevin", EMAIL.kevin, `/issues/${iss1038.id}`, "Incident contact");
  await block("Incident-contact-partner-Lukas", EMAIL.lukas, `/issues/${fx.parentId}`, "Incident contact");
  await block("About-this-issue-ISS-1038-Kevin", EMAIL.kevin, `/issues/${iss1038.id}`, "About this issue");
  await block("About-this-issue-ISS-1046-Adrian", EMAIL.adrian, `/issues/${fx.childId}`, "About this issue");
});
