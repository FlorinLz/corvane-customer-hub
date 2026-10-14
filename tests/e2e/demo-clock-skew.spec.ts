import "dotenv/config";

import { expect, test, type Page } from "@playwright/test";

import { db } from "@/server/db";
import { signUserCookie, SESSION_COOKIE } from "@/server/session";
import { effectiveCommunicator } from "@/server/derived/communicator";
import { formatInZone } from "@/lib/time-zones";
import { resetDemoData } from "./fixtures/reset";

/**
 * demo-clock-writes bug fix. Runs only under the `demo-clock-skew`
 * Playwright project: a real production build (`next build && next start`)
 * whose demo clock starts at a fixed weekday anchor in the past
 * (playwright.config.ts's DEMO_CLOCK_SKEW_START, at least 5 days behind "now") -- a deliberate, growing
 * version of the exact gap the user found live: reporting an issue on
 * Revolut Ltd showed "ISS-1043 ... Kevin Lim (Ops) -2 days" in the "Open
 * issues" panel, because Issue.createdAt was written from the database's
 * own real-time @default(now()) instead of the app's own demo-clock now()
 * (src/lib/dates.ts).
 *
 * Every business timestamp this spec can reach end to end (report, add a
 * note, record a notification, resolve, close) must come from the demo
 * clock, never the real one, so each write is checked against `Date.now()`
 * (the real clock, shared with the server machine) rather than against a
 * literal expected instant -- a write from the real clock would land within
 * seconds of `Date.now()`, nowhere near the days-long gap this project's own
 * clock keeps from the moment the server process started.
 */

test.describe.configure({ mode: "serial" });

async function signInAs(page: Page, userId: string) {
  await page.context().addCookies([{ name: SESSION_COOKIE, value: signUserCookie(userId), domain: "localhost", path: "/" }]);
}

const HOUR_MS = 60 * 60 * 1000;

/**
 * `at` must be written from the demo clock (this project's own clock is
 * anchored days behind "now", see playwright.config.ts), not
 * the database's own real-time default -- a real-clock write would land
 * within seconds of `Date.now()`, nowhere close to these bounds. The lower
 * bound (36h) leaves room for however long the production build
 * took to start before the clock offset was computed. There is no tight
 * upper bound: the anchor is fixed, so the gap grows with the real date;
 * the cap only guards against an absurd value (a bad epoch).
 */
function expectWrittenFromDemoClock(at: Date, label: string) {
  const behindByMs = Date.now() - at.getTime();
  const behindByHours = behindByMs / HOUR_MS;
  expect(behindByHours, `${label}: expected more than 36h behind real time (demo clock), got ${behindByHours.toFixed(1)}h`).toBeGreaterThan(36);
  expect(behindByHours, `${label}: expected under 10 years behind real time (demo clock), got ${behindByHours.toFixed(1)}h`).toBeLessThan(10 * 365 * 24);
}

test("report, note, notify, resolve and close all write the demo clock, never the real one; ages never go negative", async ({ page, request }) => {
  test.setTimeout(120_000); // can wait up to ~a minute for the Close dialog's own minute-boundary edge case below
  await resetDemoData(request);

  const emma = await db.user.findUniqueOrThrow({ where: { email: "emma.wilson@corvane.example" } });
  await signInAs(page, emma.id);

  const revolut = await db.entity.findFirstOrThrow({ where: { legalName: "Revolut Ltd" } });

  // Report (brief 4.9.1): leave "Corvane aware at" at its own prefill (the demo
  // clock's own "now", converted to the viewer's zone) -- touching it isn't
  // the point of this spec, just confirming it is never rejected as "in the
  // future", which a real/demo clock mismatch would cause.
  await page.goto(`/entities/${revolut.id}/issues`);
  await page.getByRole("button", { name: "Report issue" }).first().click();
  const drawer = page.getByRole("dialog", { name: "Report issue" });
  await expect(drawer.getByText("Corvane aware at can't be in the future")).not.toBeVisible();

  await drawer.getByRole("combobox", { name: "Type" }).click();
  await page.getByRole("option", { name: "Wrong match result" }).click();
  await drawer.getByRole("combobox", { name: "Product line" }).click();
  await page.getByRole("option", { name: /UK CoP \/ GB/ }).click();
  await drawer.getByLabel("Description").fill("demo-clock-skew.spec.ts fixture issue: checking every write uses the demo clock.");
  await drawer.getByRole("combobox", { name: "Reported at the customer by" }).click();
  await page.getByRole("option", { name: "Someone else" }).click();
  await drawer.getByLabel("Name of the person").fill("Test Person");
  await drawer.getByRole("radio", { name: "Isolated case" }).check();
  await drawer.getByRole("radio", { name: "No" }).check();
  await drawer.getByRole("button", { name: "Report issue" }).click();

  await expect(page).toHaveURL(/\/issues\/.+\?reported=1/);
  const issueId = page.url().match(/\/issues\/([^/?]+)/)![1];

  let issue = await db.issue.findUniqueOrThrow({ where: { id: issueId }, include: { entity: { select: { ownerId: true } } } });
  const displayId = `ISS-${String(issue.number).padStart(4, "0")}`;
  expectWrittenFromDemoClock(issue.createdAt, "Issue.createdAt (reported)");

  // The exact reported bug: the "Open issues" panel's age for this same
  // issue, read right back from the same entity, must show "0 days" --
  // never a negative number -- while it's still open (NEW is in
  // ISSUE_OPEN_FOR_SIMILAR; this check has to run before it's resolved
  // below, since a resolved issue no longer appears in this panel at all).
  // The "Open issues" panel only renders in the drawer's own entity mode
  // (ReportIssueDrawer's `mode === "entity"`), so back to the entity page.
  await page.goto(`/entities/${revolut.id}/issues`);
  await page.getByRole("button", { name: "Report issue" }).first().click();
  const drawer2 = page.getByRole("dialog", { name: "Report issue" });
  await drawer2.getByRole("combobox", { name: "Type" }).click();
  await page.getByRole("option", { name: "Wrong match result" }).click();
  await drawer2.getByRole("combobox", { name: "Product line" }).click();
  await page.getByRole("option", { name: /UK CoP \/ GB/ }).click();
  const similarRow = drawer2.getByText(displayId, { exact: true }).locator("..");
  await expect(similarRow).toContainText("0 days"); // not "-1 day"/"-2 days" -- the exact reported symptom
  await page.keyboard.press("Escape");

  // Add a note (brief M21 AC7, any of the 6 teams -- Emma stays signed in).
  // Unlike every other action below, adding a note shows no success toast --
  // wait for the POST's own response, not just the later UI text, so the
  // write has actually landed before reading it back.
  await page.goto(`/issues/${issueId}`);
  await page.getByRole("region", { name: "Internal notes" }).getByRole("button", { name: "Add note" }).click();
  await page.getByPlaceholder("New internal note").fill("Checking the note's own timestamp uses the demo clock.");
  const notePosted = page.waitForResponse((r) => r.url().includes(`/api/issues/${issueId}/notes`) && r.request().method() === "POST");
  await page.getByRole("region", { name: "Internal notes" }).getByRole("button", { name: "Save", exact: true }).click();
  await notePosted;
  await expect(page.getByText("Checking the note's own timestamp uses the demo clock.")).toBeVisible();
  const addedNote = await db.issueNote.findFirstOrThrow({ where: { issueId, kind: "NOTE" }, orderBy: { createdAt: "desc" } });
  expectWrittenFromDemoClock(addedNote.createdAt, "IssueNote.createdAt (added note)");

  const ownerUser = await db.user.findUniqueOrThrow({ where: { id: issue.ownerId! } });
  const communicatorId = effectiveCommunicator(issue, { ownerId: issue.entity.ownerId }, new Date());
  const communicatorUser = await db.user.findUniqueOrThrow({ where: { id: communicatorId! } });

  // Owner acknowledges (brief M18 AC4) so the issue can be resolved below.
  await signInAs(page, ownerUser.id);
  await page.goto(`/issues/${issueId}`);
  await page.getByRole("button", { name: "Acknowledge" }).click();
  await expect(page.getByText("Issue acknowledged")).toBeVisible();

  // Communicator records the first notification.
  await signInAs(page, communicatorUser.id);
  await page.goto(`/issues/${issueId}`);
  await page.getByRole("region", { name: "Message to the customer" }).getByRole("button", { name: "Record notification" }).click();
  const notifyDialog = page.getByRole("dialog", { name: "Record notification" });
  await expect(notifyDialog.getByText(/The time can't be in the future/)).not.toBeVisible();
  await notifyDialog.getByRole("combobox", { name: "Channel" }).click();
  await page.getByRole("option", { name: "Email" }).click();
  await notifyDialog.getByRole("combobox", { name: "Person" }).click();
  await page.getByRole("option", { name: "Other person" }).click();
  await notifyDialog.getByPlaceholder("Name of the person").fill("Test Customer Contact");
  await notifyDialog.getByLabel("Message").fill("Checking the notification's own timestamp uses the demo clock, not the real one.");
  await notifyDialog.getByRole("button", { name: "Record notification" }).click();
  await expect(page.getByText("Notification recorded")).toBeVisible();

  const notification = await db.issueCommunication.findFirstOrThrow({ where: { issueId, type: "FIRST_NOTIFICATION" } });
  expectWrittenFromDemoClock(notification.createdAt, "IssueCommunication.createdAt (notification)");
  expectWrittenFromDemoClock(notification.occurredAt, "IssueCommunication.occurredAt (notification)");

  // Owner resolves.
  await signInAs(page, ownerUser.id);
  await page.goto(`/issues/${issueId}`);
  await page.getByRole("group", { name: "Issue actions" }).getByRole("button", { name: "Change status", exact: true }).click();
  const statusDialog = page.getByRole("dialog", { name: "Change status" });
  await statusDialog.getByRole("radio", { name: "Resolved" }).check();
  await statusDialog.getByLabel("Root cause").fill("Fixture root cause for demo-clock-skew.spec.ts.");
  await statusDialog.getByLabel("Solution").fill("Fixture solution for demo-clock-skew.spec.ts.");
  await statusDialog.getByRole("button", { name: "Resolve issue" }).click();
  await expect(page.getByText("Issue resolved")).toBeVisible();

  issue = await db.issue.findUniqueOrThrow({ where: { id: issueId }, include: { entity: { select: { ownerId: true } } } });
  expectWrittenFromDemoClock(issue.resolvedAt!, "Issue.resolvedAt");
  const resolution = await db.issueResolution.findFirstOrThrow({ where: { issueId } });
  expectWrittenFromDemoClock(resolution.resolvedAt, "IssueResolution.resolvedAt");

  // The Close dialog's own Time field is minute-granularity, so its prefill
  // (floored to :00 seconds) can land a few seconds *before* resolvedAt's
  // own, more precise instant -- the same pre-existing edge case
  // scenario5-issue-flow-short.spec.ts's own Step 11 comment documents and
  // works around. Not frozen here (this spec's browser clock ticks
  // naturally), so a plain real-time wait past the next minute boundary is
  // enough -- no page.clock.setFixedTime() needed.
  const resolvedAtMs = issue.resolvedAt!.getTime();
  const nextMinuteBoundary = Math.floor(resolvedAtMs / 60_000) * 60_000 + 60_000;
  await page.waitForTimeout(nextMinuteBoundary - resolvedAtMs + 1_000);

  // Communicator closes.
  await signInAs(page, communicatorUser.id);
  await page.goto(`/issues/${issueId}`);
  await page.getByRole("region", { name: "Message to the customer" }).getByRole("button", { name: "Confirm resolution with the customer", exact: true }).click();
  const closeDialog = page.getByRole("dialog", { name: "Confirm resolution" });
  await expect(closeDialog.getByText(/can't be/)).not.toBeVisible();
  await closeDialog.getByRole("combobox", { name: "Customer confirmation from" }).click();
  await page.getByRole("option", { name: "Other person" }).click();
  await closeDialog.getByPlaceholder("Name of the person").fill("Test Customer Contact");
  await closeDialog.getByRole("combobox", { name: "Channel" }).click();
  await page.getByRole("option", { name: "Email" }).click();
  await closeDialog.getByRole("button", { name: "Confirm resolution" }).click();
  await expect(page.getByText("Resolution confirmed", { exact: true })).toBeVisible();

  const closed = await db.issue.findUniqueOrThrow({ where: { id: issueId } });
  expect(closed.status).toBe("CLOSED");
  expectWrittenFromDemoClock(closed.closedAt!, "Issue.closedAt");
  const closure = await db.issueCommunication.findFirstOrThrow({ where: { issueId, type: "CLOSURE_CONFIRMED" } });
  expectWrittenFromDemoClock(closure.createdAt, "IssueCommunication.createdAt (closure)");

  // The shared audit/History backbone (src/server/audit/mutate.ts): every
  // one of the actions above went through mutate(), so this alone proves
  // the central fix, not just the issue-specific ones above.
  const historyEvent = await db.historyEvent.findFirstOrThrow({ where: { issueId }, orderBy: { createdAt: "desc" } });
  expectWrittenFromDemoClock(historyEvent.createdAt, "HistoryEvent.createdAt");
  const auditEntry = await db.auditEntry.findFirstOrThrow({ where: { objectId: issueId }, orderBy: { createdAt: "desc" } });
  expectWrittenFromDemoClock(auditEntry.createdAt, "AuditEntry.createdAt");
});

/**
 * Three more live findings, all on a linked customer issue (brief M23) --
 * none of them about the demo clock's *value*, but all three only ever
 * showed up because this project's own skew makes a linked issue's page
 * stay open long enough (via the real-time waits below) for the drift
 * between a stale server-computed value and a live client-ticking one to
 * actually appear, so they belong in the same spec rather than a new one.
 */
test("a linked issue's own owner-inherited label, acknowledge clock and deadline banner are all correct", async ({ page, request }) => {
  test.setTimeout(150_000); // two real-time waits below (minute-boundary-style ticks)
  await resetDemoData(request);

  const lukas = await db.user.findUniqueOrThrow({ where: { email: "lukas.brenner@corvane.example" } });
  await signInAs(page, lukas.id);

  const lloyds = await db.entity.findFirstOrThrow({ where: { legalName: "Lloyds Bank plc" } });

  // Report the partner issue (brief M23 AC1) -- Down/No breach is SEV1, so
  // every linked child below inherits SEV1 too and keeps a running
  // "Customer notification" clock, needed for the banner check further down.
  await page.goto(`/entities/${lloyds.id}/overview`);
  await page.getByRole("button", { name: "Report issue" }).click();
  const partnerDrawer = page.getByRole("dialog", { name: "Report issue" });
  await partnerDrawer.getByRole("combobox", { name: "Type" }).click();
  await page.getByRole("option", { name: "Partner degraded or unavailable" }).click();
  await partnerDrawer.getByRole("radio", { name: /UK CoP \/ GB/ }).check(); // Lloyds has three coverages: pick the one, no scheme or country to type
  await partnerDrawer.getByLabel("Description").fill("demo-clock-skew.spec.ts fixture partner issue for the linked-issue checks below.");
  await partnerDrawer.getByRole("combobox", { name: "Reported at the customer by" }).click();
  await page.getByRole("option", { name: "Found by Corvane" }).click();
  await partnerDrawer.getByRole("radio", { name: "Down" }).check();
  await partnerDrawer.getByRole("radio", { name: "No" }).check();
  await partnerDrawer.getByRole("button", { name: "Report issue" }).click();

  await expect(page).toHaveURL(/\/issues\/.+\?reported=1/);
  const parentId = page.url().match(/\/issues\/([^/?]+)/)![1];
  const parent = await db.issue.findUniqueOrThrow({ where: { id: parentId } });
  const parentDisplayId = `ISS-${String(parent.number).padStart(4, "0")}`;

  // Fan out to every affected customer (brief M23 AC7) -- which ones, and
  // how many, isn't the point here, just that at least one child exists.
  await page.getByRole("button", { name: "Create linked issues" }).click();
  const linkDialog = page.getByRole("dialog", { name: "Create linked issues" });
  await linkDialog.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByText("Linked issues created")).toBeVisible();

  const childLink = await db.issueLink.findFirstOrThrow({ where: { parentId, kind: "CREATED", unlinkedAt: null } });
  const childId = childLink.childId;
  const child = await db.issue.findUniqueOrThrow({ where: { id: childId } });
  expect(child.routingRule).toBe("INHERITED_FROM_PARENT");
  expect(child.severity).toBe("SEV1");

  // Item 3: "Why this owner" must read once, not duplicated -- the fixed
  // bug wrote "Why this owner: Why this owner: inherited from partner
  // issue ISS-...", `routingReason` itself already carrying the prefix.
  await page.goto(`/issues/${childId}`);
  await expect(page.getByText(/Why this owner:.*Why this owner:/)).not.toBeVisible();
  await expect(page.getByText(`Why this owner: inherited from partner issue ${parentDisplayId}`, { exact: true })).toBeVisible();

  // Item 2, parent not yet acknowledged: a clickable "Acknowledge on
  // ISS-<parent>" badge, not a misleading running "Acknowledge in Xmin"
  // clock this issue can never stop (it needs no acknowledgement of its
  // own, brief M23 -- there is correctly no Acknowledge button here).
  await expect(page.getByRole("button", { name: "Acknowledge" })).toHaveCount(0);
  const ackLink = page.getByRole("link", { name: `Acknowledge on ${parentDisplayId}` });
  await expect(ackLink).toBeVisible();
  await expect(page.getByText(/Acknowledge (in|by|now)\b/)).not.toBeVisible();
  await ackLink.click();
  await expect(page).toHaveURL(new RegExp(`/issues/${parentId}$`));

  // Acknowledge the parent (Lukas is both its owner and, via
  // ISSUE_OWNER_PARTNER, its own communicator -- no identity switch).
  await page.getByRole("button", { name: "Acknowledge" }).click();
  await expect(page.getByText("Issue acknowledged")).toBeVisible();

  // Item 2, parent now acknowledged: the clock becomes a plain
  // "Acknowledged via ISS-<parent>" badge, no link, never a running clock.
  await page.goto(`/issues/${childId}`);
  await expect(page.getByText(`Acknowledged via ${parentDisplayId}`)).toBeVisible();
  await expect(page.getByRole("link", { name: `Acknowledge on ${parentDisplayId}` })).toHaveCount(0);

  // Item 4 (rewritten by the role actions PR, which removed the top deadline banner and the Clocks card):
  // the one place a deadline shows is the Action plan time block, and it must keep ticking
  // from the page-load baseline instead of staying frozen at the server-rendered value. Deliberately
  // NOT reloading: staying on this same page for a real minute lets the client-ticking time block
  // advance from its page-load baseline. A reload would hand it a fresh baseline and hide the bug.
  await expect(page.locator("section.border-l-due")).toHaveCount(0);
  await expect(page.getByText(/Overdue by/)).toHaveCount(0);
  const notifyTime = page.getByRole("region", { name: "Action plan" }).getByTestId("plan-time-notify").locator("span").first();
  const textBefore = (await notifyTime.innerText()).trim();
  expect(textBefore).toMatch(/^(in \d+ min|in \d+ h( \d+ min)?|Overdue .+)$/);

  await page.waitForTimeout(65_000);

  const textAfter = (await notifyTime.innerText()).trim();
  expect(textAfter, "the time block must have ticked forward after a real minute").not.toBe(textBefore);
});

/**
 * A second round of this same bug, same live session: "Set to Degraded" on
 * the Lloyds UK CoP / GB coverage (and any Change stage action, fixed
 * identically but not covered by this spec) also relied on
 * CoverageStatusChange.createdAt's own @default(now()), missed by the
 * first pass because it isn't on the Issue model. Beyond just showing the
 * wrong instant, a real-clock CoverageStatusChange.createdAt is *always*
 * later than any demo-clock Issue.createdAt, so the comparison
 * src/server/queries/issue-partner-panels.ts runs to decide whether a
 * partner issue's own coverage was "changed since creation" --
 * `c.createdAt >= issueCreatedAt` -- would have come out true for every
 * partner issue regardless of when the coverage was actually changed,
 * permanently stuck showing the "already set to Degraded" banner instead
 * of "Set it to Degraded?" for a fresh issue. Fixed by threading `now`
 * (the mutate() transaction's own `now()` instant, src/server/audit/mutate.ts)
 * through to every direct `tx.coverageStatusChange.create()` /
 * `tx.stageEvent.create()` call.
 */
test("coverage set to Degraded writes the demo clock; the degraded-since-creation banner shows it", async ({ page, request }) => {
  test.setTimeout(60_000);
  await resetDemoData(request);

  const lukas = await db.user.findUniqueOrThrow({ where: { email: "lukas.brenner@corvane.example" } });
  await signInAs(page, lukas.id);

  const lloyds = await db.entity.findFirstOrThrow({ where: { legalName: "Lloyds Bank plc" } });

  // Report a partner issue while UK CoP / GB coverage is still Active --
  // this issue's own createdAt is the "since creation" baseline below.
  await page.goto(`/entities/${lloyds.id}/overview`);
  await page.getByRole("button", { name: "Report issue" }).click();
  const drawer = page.getByRole("dialog", { name: "Report issue" });
  await drawer.getByRole("combobox", { name: "Type" }).click();
  await page.getByRole("option", { name: "Partner degraded or unavailable" }).click();
  await drawer.getByRole("radio", { name: /UK CoP \/ GB/ }).check(); // Lloyds has three coverages: pick the one, no scheme or country to type
  await drawer.getByLabel("Description").fill("demo-clock-skew.spec.ts fixture issue for the Set to Degraded check.");
  await drawer.getByRole("combobox", { name: "Reported at the customer by" }).click();
  await page.getByRole("option", { name: "Found by Corvane" }).click();
  await drawer.getByRole("radio", { name: "Down" }).check();
  await drawer.getByRole("radio", { name: "No" }).check();
  await drawer.getByRole("button", { name: "Report issue" }).click();

  await expect(page).toHaveURL(/\/issues\/.+\?reported=1/);
  const issueId = page.url().match(/\/issues\/([^/?]+)/)![1];
  const issue = await db.issue.findUniqueOrThrow({ where: { id: issueId } });

  await expect(page.getByText(/Coverage UK CoP \/ GB is Active\. Set it to Degraded\?/)).toBeVisible();

  await page.getByRole("button", { name: "Set to Degraded" }).click();
  const coverageDialog = page.getByRole("dialog", { name: /Change status/ });
  await coverageDialog.getByRole("radio", { name: "Degraded" }).check();
  await coverageDialog.getByRole("button", { name: "Save status" }).click();
  await expect(page.getByText("Coverage status saved")).toBeVisible();

  const change = await db.coverageStatusChange.findFirstOrThrow({
    where: { coverage: { scheme: "UK_COP", country: "GB", partnerRole: { entityId: lloyds.id } } },
    orderBy: { createdAt: "desc" },
  });
  expectWrittenFromDemoClock(change.createdAt, "CoverageStatusChange.createdAt");

  // The exact comparison the banner's own query runs: only ever correct
  // when both sides are demo-clock timestamps.
  expect(change.createdAt.getTime(), "coverage change must be at or after the issue's own demo-clock createdAt").toBeGreaterThanOrEqual(issue.createdAt.getTime());

  // router.refresh() (ChangeCoverageStatusDialog's own save()) re-renders
  // this same page with the now-populated changedSinceCreation banner --
  // no reload needed, matching scenario5-issue-flow-short.spec.ts's own
  // identical step. The expected text is computed from the DB row itself
  // (Asia/Singapore, Lukas's own seeded zone, prisma/seed/data/users.ts),
  // so a real-clock write landing on the wrong calendar day or hour would
  // fail this exact assertion, not just the bounds check above.
  const expectedTime = formatInZone(change.createdAt, "Asia/Singapore");
  await expect(page.getByText(`Coverage UK CoP / GB set to Degraded by Lukas Brenner at ${expectedTime}`)).toBeVisible();
});
