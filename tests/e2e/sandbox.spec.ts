import "dotenv/config";

import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { Pool } from "pg";

import { STORAGE_KEYS } from "@/lib/onboarding/content";
import { SANDBOX_COOKIE, SHARED_MARKER } from "@/lib/sandbox";
import { demoSnapshot } from "@/server/demo-snapshot";
import { SESSION_COOKIE, signUserCookie } from "@/server/session";

import { SERVER_ENV } from "./fixtures/server-env";

/**
 * Sandbox per visitor. Runs on the `sandbox` project: a production build with DEMO_SANDBOXES on, on the default demo clock (Mon 05 Oct 2026 10:05).
 * Every browser context here is its own visitor. The database is the local Docker one; the spec clears the sandboxes before and after it.
 */
const BASE = "http://localhost:3105";
const ADMIN_URL = process.env.DATABASE_ADMIN_URL ?? "";
const MIN = 60_000;

const kevin = "kevin.lim@corvane.example";
const emma = "emma.wilson@corvane.example";
const mei = "mei.chen@corvane.example";
const lukas = "lukas.brenner@corvane.example";

let admin: Pool;

const snapshotRows = (table: string) => demoSnapshot.tables.find((t) => t.name === table)!.rows;
const userId = (email: string) => snapshotRows("User").find((u) => u.email === email)!.id as string;
const iss1042 = snapshotRows("Issue").find((i) => i.number === 1042)!.id as string;
const lloydsId = snapshotRows("Entity").find((e) => e.legalName === "Lloyds Bank plc")!.id as string;

async function wipeSandboxes() {
  const { rows } = await admin.query(`SELECT nspname FROM pg_namespace WHERE nspname ~ '^sbx_[0-9a-f]{16}$'`);
  for (const r of rows) await admin.query(`DROP SCHEMA IF EXISTS "${r.nspname}" CASCADE`);
  await admin.query(`DELETE FROM public."DemoSandbox"`);
}

test.beforeAll(async () => {
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(ADMIN_URL)) throw new Error("The sandbox spec clears sandboxes: DATABASE_ADMIN_URL must point at localhost.");
  admin = new Pool({ connectionString: ADMIN_URL, max: 2 });
  await wipeSandboxes();
});

test.afterAll(async () => {
  await new Promise((r) => setTimeout(r, 3000)); // a background refill may still be building a spare
  await wipeSandboxes();
  await admin.end();
});

interface Visitor {
  context: BrowserContext;
  page: Page;
  schema: string;
}

const cookieOf = async (context: BrowserContext, name: string) => (await context.cookies()).find((c) => c.name === name);
const schemaOf = async (context: BrowserContext) => ((await cookieOf(context, SANDBOX_COOKIE))?.value ?? "").split(".")[0];

/** A new visitor: their own context, with the welcome card out of the way. Opens Home and waits for the app, past the Preparing screen. */
async function newVisitor(browser: Browser, opts: { welcome?: boolean; cookies?: { name: string; value: string }[] } = {}): Promise<Visitor> {
  const context = await browser.newContext({ baseURL: BASE, timezoneId: "Europe/Bucharest" });
  await context.addInitScript(
    ({ keys, welcome }) => {
      localStorage.setItem(keys.mobileDismissed, "1");
      if (!welcome) localStorage.setItem(keys.welcomeDismissed, "1");
    },
    { keys: STORAGE_KEYS, welcome: !!opts.welcome },
  );
  if (opts.cookies?.length) await context.addCookies(opts.cookies.map((c) => ({ ...c, url: BASE })));
  const page = await context.newPage();
  page.on("dialog", () => {
    throw new Error("A browser dialog opened: the app must use its own dialogs");
  });
  await page.goto("/");
  await expect(page.getByText("Demo mode", { exact: true })).toBeVisible({ timeout: 60_000 });
  return { context, page, schema: await schemaOf(context) };
}

async function as(context: BrowserContext, email: string) {
  await context.addCookies([{ name: SESSION_COOKIE, value: signUserCookie(userId(email)), url: BASE }]);
}

/** Reads one sandbox's rows: the schema is named in the SQL, so the pooled connection's search_path never matters. */
async function issueStatus(schema: string, number = 1042): Promise<string> {
  const res = await admin.query(`SELECT "status" FROM "${schema}"."Issue" WHERE "number" = $1`, [number]);
  return res.rows[0].status;
}

/** Kevin resolves ISS-1042, Emma confirms, Kevin shares the draft, Mei approves, Kevin records it sent: the issue closes. All through the UI. */
async function closeIss1042(visitor: Visitor) {
  const { page, context } = visitor;
  await context.route("https://mail.google.com/**", (r) => r.fulfill({ body: "ok" }));
  const open = async (email: string) => {
    await as(context, email);
    await page.goto(`/issues/${iss1042}`);
    await expect(page.getByRole("region", { name: "Your next action" })).toBeVisible();
  };

  await open(kevin);
  await page.getByRole("group", { name: "Issue actions" }).getByRole("button", { name: "Change status", exact: true }).click();
  const status = page.getByRole("dialog", { name: "Change status" });
  await status.getByRole("radio", { name: "Resolved" }).check();
  await status.getByLabel("Root cause").fill("The endpoint certificate expired after the rotation job failed.");
  await status.getByLabel("Solution").fill("Kevin renewed the certificate and fixed the rotation job.");
  await status.getByRole("button", { name: "Resolve issue" }).click();
  await expect(page.getByText("Issue resolved")).toBeVisible();

  await open(emma);
  await page.getByRole("region", { name: "Message to the customer" }).getByRole("button", { name: "Confirm resolution with the customer", exact: true }).click();
  const confirm = page.getByRole("dialog", { name: "Confirm resolution" });
  await confirm.getByRole("combobox", { name: "Channel" }).click();
  await page.getByRole("option", { name: "Email" }).click();
  await confirm.getByRole("button", { name: "Confirm resolution" }).click();
  await expect(page.getByText("Resolution confirmed", { exact: true })).toBeVisible();

  await open(kevin);
  await page.getByRole("region", { name: "Your next action" }).getByRole("button", { name: "Share draft" }).click();
  const share = page.getByRole("dialog", { name: "Share draft of the root cause report" });
  await share.getByLabel("Draft link *").fill("https://docs.corvane-internal.example/reports/iss-1042-draft.pdf");
  await share.getByLabel("Summary *").fill("Cause: the certificate expired. Impact: every MPS name check failed. Fix: a renewed certificate and a repaired rotation job.");
  await share.getByRole("button", { name: "Share draft" }).click();
  await expect(page.getByText("Draft shared", { exact: true })).toBeVisible();

  await open(mei);
  await page.getByRole("region", { name: "Your next action" }).getByRole("button", { name: "Approve report" }).click();
  await page.getByRole("dialog", { name: "Approve root cause report" }).getByRole("button", { name: "Approve report" }).click();
  await expect(page.getByText("Report approved", { exact: true })).toBeVisible();

  await open(kevin);
  await page.getByRole("region", { name: "Your next action" }).getByRole("button", { name: "Record report sent" }).click();
  const sent = page.getByRole("dialog", { name: "Record report sent" });
  await sent.getByRole("combobox", { name: "Channel" }).click();
  await page.getByRole("option", { name: "Email" }).click();
  await sent.getByRole("button", { name: "Record report sent" }).click();
  await expect.poll(() => issueStatus(visitor.schema), { timeout: 30_000 }).toBe("CLOSED");
}

test("a new visitor gets their own schema, and the cookies for it and the clock together", async ({ browser }) => {
  const a = await newVisitor(browser);
  const b = await newVisitor(browser);
  expect(a.schema).toMatch(/^sbx_[0-9a-f]{16}$/);
  expect(b.schema).toMatch(/^sbx_[0-9a-f]{16}$/);
  expect(a.schema).not.toBe(b.schema);

  const sandboxCookie = (await cookieOf(a.context, SANDBOX_COOKIE))!;
  const arrival = (await cookieOf(a.context, "ch_arrival"))!;
  expect(sandboxCookie.httpOnly).toBe(true);
  for (const c of [sandboxCookie, arrival]) {
    expect(c.expires * 1000 - Date.now()).toBeGreaterThan(23.9 * 60 * MIN);
    expect(c.expires * 1000 - Date.now()).toBeLessThan(24.1 * 60 * MIN);
  }
  const [row] = (await admin.query(`SELECT status, "expiresAt" FROM public."DemoSandbox" WHERE "schemaName" = $1`, [a.schema])).rows;
  expect(row.status).toBe("ASSIGNED");
  expect(Math.abs(row.expiresAt.getTime() - (Number(arrival.value) + 24 * 60 * MIN))).toBeLessThan(1000);
  await expect(a.page.getByText(/Demo time: Mon 05 Oct, 10:\d\d CEST/)).toBeVisible();
  await expect(a.page.getByTestId("demo-notice")).toContainText("This copy of the demo is yours for 24 hours.");
  await expect(a.page.getByRole("button", { name: "Start over" })).toBeVisible();
  await a.context.close();
  await b.context.close();
});

test("visitor A resolves and closes ISS-1042; visitor B still sees it In progress", async ({ browser }) => {
  test.setTimeout(240_000);
  const a = await newVisitor(browser);
  const b = await newVisitor(browser);
  await closeIss1042(a);

  expect(await issueStatus(a.schema)).toBe("CLOSED");
  expect(await issueStatus(b.schema)).toBe("IN_PROGRESS");

  await as(a.context, kevin);
  await a.page.goto(`/issues/${iss1042}`);
  await expect(a.page.getByText("Closed", { exact: true }).first()).toBeVisible();
  await as(b.context, kevin);
  await b.page.goto(`/issues/${iss1042}`);
  await expect(b.page.getByText("In progress", { exact: true }).first()).toBeVisible();
  await expect(b.page.getByText("Closed", { exact: true })).toHaveCount(0);
  await a.context.close();
  await b.context.close();
});

test("visitor A reports the Lloyds issue; visitor B has no Lloyds issue", async ({ browser }) => {
  test.setTimeout(120_000);
  const a = await newVisitor(browser);
  const b = await newVisitor(browser);
  const lloydsIssues = (schema: string) =>
    admin.query(`SELECT count(*)::int AS n FROM "${schema}"."Issue" WHERE "entityId" = $1 AND "type" = 'PARTNER_DEGRADED'`, [lloydsId]).then((r) => r.rows[0].n as number);
  const before = await lloydsIssues(a.schema);

  await as(a.context, lukas);
  await a.page.goto(`/entities/${lloydsId}/overview`);
  await a.page.getByRole("button", { name: "Report issue" }).click();
  const drawer = a.page.getByRole("dialog", { name: "Report issue" });
  await drawer.getByRole("combobox", { name: "Type" }).click();
  await a.page.getByRole("option", { name: "Partner degraded or unavailable" }).click();
  await drawer.getByRole("radio", { name: /UK CoP \/ GB/ }).check();
  await drawer.getByLabel("Description").fill("Lloyds Bank plc CoP responses time out for visitor A only.");
  await drawer.getByRole("combobox", { name: "Reported at the customer by" }).click();
  await a.page.getByRole("option", { name: "Found by Corvane" }).click();
  await drawer.getByRole("radio", { name: "Down" }).check();
  await drawer.getByRole("radio", { name: "No" }).check();
  await drawer.getByRole("button", { name: "Report issue" }).click();
  await expect(a.page).toHaveURL(/\/issues\/.+\?reported=1/);

  expect(await lloydsIssues(a.schema)).toBe(before + 1);
  expect(await lloydsIssues(b.schema)).toBe(before);
  const aNumbers = (await admin.query(`SELECT max("number")::int AS n FROM "${a.schema}"."Issue"`)).rows[0].n;
  const bNumbers = (await admin.query(`SELECT max("number")::int AS n FROM "${b.schema}"."Issue"`)).rows[0].n;
  expect(aNumbers).toBe(bNumbers + 1); // A's new issue took the next number of A's own sequence

  await as(b.context, lukas);
  await b.page.goto("/");
  await expect(b.page.getByText("CoP responses time out for visitor A only")).toHaveCount(0);
  await b.page.goto(`/entities/${lloydsId}/overview`);
  await expect(b.page.getByText("CoP responses time out for visitor A only")).toHaveCount(0);
  await a.context.close();
  await b.context.close();
});

test("Start over asks in an app dialog, then puts the visitor's copy back to Monday 10:05", async ({ browser }) => {
  test.setTimeout(240_000);
  const a = await newVisitor(browser);
  // (The welcome card is dismissed for every visitor here; the test opens it from the demo bar.)
  const b = await newVisitor(browser);
  const { page, context } = a;

  // A has been in the demo for two hours and has changed things.
  const arrival = Date.now() - 120 * MIN;
  await admin.query(`UPDATE public."DemoSandbox" SET "expiresAt" = $2 WHERE "schemaName" = $1`, [a.schema, new Date(arrival + 24 * 60 * MIN)]);
  await context.addCookies([{ name: "ch_arrival", value: String(arrival), url: BASE }]);
  await as(context, kevin);
  await page.goto("/");
  await expect(page.getByText(/Demo time: Mon 05 Oct, 12:\d\d CEST/)).toBeVisible();
  await admin.query(`UPDATE "${a.schema}"."Issue" SET "status" = 'RESOLVED' WHERE "number" = 1042`);
  const seedOfB = (await admin.query(`SELECT "seedVersion" FROM "${b.schema}"."DemoMeta"`)).rows[0].seedVersion as number;
  const seedBefore = (await admin.query(`SELECT "seedVersion" FROM "${a.schema}"."DemoMeta"`)).rows[0].seedVersion as number;

  // The panel has progress to lose: open scenario 1 from the welcome card.
  await page.getByRole("button", { name: "About this demo" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Next" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Next" }).click();
  await page.locator('[data-onboarding="scenario-card-1"]').click();
  await expect(page.getByRole("complementary", { name: "Scenario 1" })).toBeVisible();

  await page.getByRole("button", { name: "Start over" }).click();
  const dialog = page.getByRole("dialog", { name: "Start over?" });
  await expect(dialog).toContainText("Your copy of the demo goes back to Monday 10:05. Changes you made are removed.");
  await expect(dialog.getByRole("button", { name: "Start over" })).toBeVisible();

  // Cancel changes nothing.
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveCount(0);
  expect(await issueStatus(a.schema)).toBe("RESOLVED");

  await page.getByRole("button", { name: "Start over" }).click();
  await page.getByRole("dialog", { name: "Start over?" }).getByRole("button", { name: "Start over" }).click();
  await expect(page).toHaveURL(`${BASE}/`);
  await expect(page.getByText(/Demo time: Mon 05 Oct, 10:0\d CEST/)).toBeVisible({ timeout: 30_000 });

  expect(await issueStatus(a.schema)).toBe("IN_PROGRESS");
  expect((await admin.query(`SELECT "seedVersion" FROM "${a.schema}"."DemoMeta"`)).rows[0].seedVersion).toBe(seedBefore + 1);
  expect(await schemaOf(context)).toBe(a.schema); // the same schema, restored
  const arrivalAfter = Number((await cookieOf(context, "ch_arrival"))!.value);
  expect(Math.abs(arrivalAfter - Date.now())).toBeLessThan(2 * MIN);
  const [row] = (await admin.query(`SELECT "expiresAt" FROM public."DemoSandbox" WHERE "schemaName" = $1`, [a.schema])).rows;
  expect(Math.abs(row.expiresAt.getTime() - (arrivalAfter + 24 * 60 * MIN))).toBeLessThan(1000);
  // The scenario panel starts again: the new seedVersion clears what it remembered, and the data checks read the restored data, so no step is done.
  const panel = page.getByRole("complementary", { name: "Scenario 1" });
  await expect(panel.locator("[data-onboarding-step]").first()).toBeVisible();
  await expect(panel.locator('[data-onboarding-step][data-done="true"]')).toHaveCount(0);

  // Nobody else was touched.
  expect(await issueStatus(b.schema)).toBe("IN_PROGRESS");
  expect((await admin.query(`SELECT "seedVersion" FROM "${b.schema}"."DemoMeta"`)).rows[0].seedVersion).toBe(seedOfB);
  await a.context.close();
  await b.context.close();
});

test("an expired, tampered, half-missing or stale cookie gets a new sandbox and a new arrival", async ({ browser }) => {
  test.setTimeout(240_000);
  const sandboxIsNew = async (v: Visitor, old: string) => {
    expect(v.schema).toMatch(/^sbx_[0-9a-f]{16}$/);
    expect(v.schema).not.toBe(old);
    expect((await admin.query(`SELECT status FROM public."DemoSandbox" WHERE "schemaName" = $1`, [v.schema])).rows[0].status).toBe("ASSIGNED");
    expect(Math.abs(Number((await cookieOf(v.context, "ch_arrival"))!.value) - Date.now())).toBeLessThan(2 * MIN);
    await expect(v.page.getByText(/Demo time: Mon 05 Oct, 10:\d\d CEST/)).toBeVisible();
  };
  const original = await newVisitor(browser);
  const sandboxValue = (await cookieOf(original.context, SANDBOX_COOKIE))!.value;
  const arrivalValue = (await cookieOf(original.context, "ch_arrival"))!.value;
  const old = original.schema;
  await original.context.close();
  const cookies = (over: Record<string, string | undefined>) =>
    Object.entries({ [SANDBOX_COOKIE]: sandboxValue, ch_arrival: arrivalValue, ...over })
      .filter(([, v]) => v !== undefined)
      .map(([name, value]) => ({ name, value: value as string }));

  // 0. Both cookies valid: the visitor keeps their sandbox.
  const same = await newVisitor(browser, { cookies: cookies({}) });
  expect(same.schema).toBe(old);
  await same.context.close();

  // 1. A signature that is not ours.
  const tampered = await newVisitor(browser, { cookies: cookies({ [SANDBOX_COOKIE]: `${old}.${"0".repeat(64)}` }) });
  await sandboxIsNew(tampered, old);
  await tampered.context.close();

  // 2. The arrival cookie is missing.
  const noArrival = await newVisitor(browser, { cookies: cookies({ ch_arrival: undefined }) });
  await sandboxIsNew(noArrival, old);
  await noArrival.context.close();

  // 3. The sandbox cookie is missing.
  const noSandbox = await newVisitor(browser, { cookies: cookies({ [SANDBOX_COOKIE]: undefined }) });
  await sandboxIsNew(noSandbox, old);
  await noSandbox.context.close();

  // 4. The arrival is more than 24 hours old.
  const oldArrival = await newVisitor(browser, { cookies: cookies({ ch_arrival: String(Date.now() - 30 * 60 * MIN) }) });
  await sandboxIsNew(oldArrival, old);
  await oldArrival.context.close();

  // 5. The sandbox expired in the registry.
  await admin.query(`UPDATE public."DemoSandbox" SET "expiresAt" = now() - interval '1 minute' WHERE "schemaName" = $1`, [old]);
  const expired = await newVisitor(browser, { cookies: cookies({}) });
  await sandboxIsNew(expired, old);
  await expired.context.close();

  // 6. The sandbox is gone, and 7. it was made from an older DDL.
  const second = await newVisitor(browser);
  const secondValue = (await cookieOf(second.context, SANDBOX_COOKIE))!.value;
  const secondArrival = (await cookieOf(second.context, "ch_arrival"))!.value;
  const secondSchema = second.schema;
  await second.context.close();
  await admin.query(`UPDATE public."DemoSandbox" SET "ddlHash" = 'an-older-ddl' WHERE "schemaName" = $1`, [secondSchema]);
  const stale = await newVisitor(browser, { cookies: [{ name: SANDBOX_COOKIE, value: secondValue }, { name: "ch_arrival", value: secondArrival }] });
  await sandboxIsNew(stale, secondSchema);
  const staleValue = (await cookieOf(stale.context, SANDBOX_COOKIE))!.value;
  const staleArrival = (await cookieOf(stale.context, "ch_arrival"))!.value;
  const staleSchema = stale.schema;
  await stale.context.close();
  await admin.query(`DROP SCHEMA "${staleSchema}" CASCADE`);
  await admin.query(`DELETE FROM public."DemoSandbox" WHERE "schemaName" = $1`, [staleSchema]);
  const gone = await newVisitor(browser, { cookies: [{ name: SANDBOX_COOKIE, value: staleValue }, { name: "ch_arrival", value: staleArrival }] });
  await sandboxIsNew(gone, staleSchema);
  await gone.context.close();
});

test("when a sandbox cannot be made, the visitor gets the shared demo and the bar says so", async ({ browser }) => {
  const before = (await admin.query(`SELECT count(*)::int AS n FROM public."DemoSandbox"`)).rows[0].n as number;
  const shared = await newVisitor(browser, { cookies: [{ name: "ch_test_sandbox_fail", value: "1" }] });
  expect((await cookieOf(shared.context, SANDBOX_COOKIE))!.value).toBe(SHARED_MARKER);
  expect(shared.schema).toBe(SHARED_MARKER);
  await expect(shared.page.getByTestId("demo-notice")).toContainText("Shared demo: other visitors may be using it.");
  await expect(shared.page.getByTestId("demo-notice")).toContainText("The demo resets after 20 minutes without changes.");
  await expect(shared.page.getByRole("button", { name: "Start over" })).toHaveCount(0);
  // The clock still runs: the shared fallback gets its arrival cookie from the proxy as before.
  expect((await cookieOf(shared.context, "ch_arrival"))!.value).toMatch(/^\d{13}$/);
  // Nothing was created for them.
  expect((await admin.query(`SELECT count(*)::int AS n FROM public."DemoSandbox" WHERE "assignedAt" > now() - interval '1 minute' AND status = 'ASSIGNED'`)).rows[0].n).toBeLessThanOrEqual(before);
  await shared.context.close();
});

test("the daily cron drops an expired sandbox, and an orphan, and keeps a live one", async ({ browser, request }) => {
  test.setTimeout(240_000);
  const cron = (secret?: string) => request.get(`${BASE}/api/cron/demo-restore`, { headers: secret ? { authorization: `Bearer ${secret}` } : {} });
  expect((await cron()).status()).toBe(401);
  expect((await cron("wrong")).status()).toBe(401);

  const live = await newVisitor(browser);
  const expiring = await newVisitor(browser);
  await expiring.context.close();
  await admin.query(`UPDATE public."DemoSandbox" SET "expiresAt" = now() - interval '2 hours' WHERE "schemaName" = $1`, [expiring.schema]);
  const orphan = "sbx_00000000deadbeef";
  await admin.query(`CREATE SCHEMA IF NOT EXISTS "${orphan}"`);

  const res = await cron(SERVER_ENV.sandbox.CRON_SECRET);
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.sandboxes.expired).toContain(expiring.schema);
  expect(body.sandboxes.orphans).toContain(orphan);
  expect(body.sandboxes.expired).not.toContain(live.schema);

  const names = (await admin.query(`SELECT nspname FROM pg_namespace WHERE nspname ~ '^sbx_'`)).rows.map((r) => r.nspname as string);
  expect(names).not.toContain(expiring.schema);
  expect(names).not.toContain(orphan);
  expect(names).toContain(live.schema);
  expect((await admin.query(`SELECT 1 FROM public."DemoSandbox" WHERE "schemaName" = $1`, [expiring.schema])).rows).toEqual([]);

  // The live visitor carries on, in their own copy.
  await live.page.reload();
  await expect(live.page.getByText("Demo mode", { exact: true })).toBeVisible();
  expect(await schemaOf(live.context)).toBe(live.schema);
  await live.context.close();
});
