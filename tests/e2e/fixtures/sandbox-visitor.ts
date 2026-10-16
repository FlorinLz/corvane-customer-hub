import "dotenv/config";

import type { Browser, BrowserContext, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { Pool } from "pg";

import { STORAGE_KEYS } from "@/lib/onboarding/content";
import { SANDBOX_COOKIE } from "@/lib/sandbox";
import { demoSnapshot } from "@/server/demo-snapshot";
import { SESSION_COOKIE, signUserCookie } from "@/server/session";

/**
 * Visitors of the sandbox project (port 3105, Mon 05 Oct 2026 10:05 CEST): each browser context is a visitor with a private copy of the demo data,
 * and the data of one can be read and shaped through the admin connection (local Docker only).
 */
export const SANDBOX_BASE = "http://localhost:3105";

export interface Visitor {
  context: BrowserContext;
  page: Page;
  schema: string;
}

export const userId = (email: string) => demoSnapshot.tables.find((t) => t.name === "User")!.rows.find((u) => u.email === email)!.id as string;
export const issueId = (number: number) => demoSnapshot.tables.find((t) => t.name === "Issue")!.rows.find((i) => i.number === number)!.id as string;

export function adminPool(): Pool {
  const url = process.env.DATABASE_ADMIN_URL ?? "";
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) throw new Error("The sandbox specs use the local Docker database: DATABASE_ADMIN_URL must point at localhost.");
  return new Pool({ connectionString: url, max: 2 });
}

export async function wipeSandboxes(admin: Pool) {
  const { rows } = await admin.query(`SELECT nspname FROM pg_namespace WHERE nspname ~ '^sbx_[0-9a-f]{16}$'`);
  for (const r of rows) await admin.query(`DROP SCHEMA IF EXISTS "${r.nspname}" CASCADE`);
  await admin.query(`DELETE FROM public."DemoSandbox"`);
}

/** A new visitor: their own context, welcome card and mobile notice out of the way. Opens Home and waits for the app, past the Preparing screen. */
export async function newVisitor(browser: Browser, opts: { panel?: { scenario: 1 | 2; chapter: string } } = {}): Promise<Visitor> {
  const context = await browser.newContext({ baseURL: SANDBOX_BASE, timezoneId: "Europe/Bucharest", viewport: { width: 1440, height: 900 } });
  await context.addInitScript(
    ({ keys, panel }) => {
      localStorage.setItem(keys.mobileDismissed, "1");
      localStorage.setItem(keys.welcomeDismissed, "1");
      localStorage.removeItem(keys.panel);
      if (panel) localStorage.setItem(keys.panel, JSON.stringify({ ...panel, collapsed: false, closedPrologues: [], openedPrologues: [] }));
    },
    { keys: STORAGE_KEYS, panel: opts.panel ?? null },
  );
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.getByText("Demo mode", { exact: true })).toBeVisible({ timeout: 60_000 });
  const schema = ((await context.cookies()).find((c) => c.name === SANDBOX_COOKIE)?.value ?? "").split(".")[0];
  return { context, page, schema };
}

export async function as(context: BrowserContext, email: string) {
  await context.addCookies([{ name: SESSION_COOKIE, value: signUserCookie(userId(email)), url: SANDBOX_BASE }]);
}
