import { timingSafeEqual } from "node:crypto";

import type { PrismaClient } from "@prisma/client";

import { db } from "@/server/db";
import { createAdminDb } from "@/server/db-admin";
import { ConflictError } from "@/server/errors";
import { RESTORE_LOCK_KEY, restoreDemoData } from "@/server/demo-reset";
import { atFreshClock } from "@/server/request-clock";

/** The demo restores itself this many minutes after the last data write by any visitor. The Demo bar says the same number. */
export const IDLE_MINUTES = 20;

export interface DemoState {
  /** Data was written since the last restore and nobody wrote for IDLE_MINUTES. Measured by the database's clock. */
  idleDue: boolean;
  /** A restore holds the advisory lock right now. */
  restoreRunning: boolean;
  /** When the data was last restored (epoch ms), or null when it never was. */
  lastRestoreAtMs: number | null;
}

/** Whether `lastWriteAt` (epoch ms or null) is older than the idle limit at `nowMs`. The same rule as the SQL in readDemoState, for tests. */
export function isIdleDue(lastWriteAtMs: number | null, nowMs: number): boolean {
  return lastWriteAtMs !== null && lastWriteAtMs < nowMs - IDLE_MINUTES * 60_000;
}

/**
 * Whether a page request has to go through "Preparing a fresh demo..." before it renders: a restore is due or running, or the visitor
 * arrived before the last restore (their clock started before the data did). `arrivalMs` is undefined when there is no visitor clock.
 */
export function needsPreparing(state: DemoState, arrivalMs: number | undefined): boolean {
  if (state.restoreRunning || state.idleDue) return true;
  return arrivalMs !== undefined && state.lastRestoreAtMs !== null && arrivalMs < state.lastRestoreAtMs;
}

/** The demo state in one query on the runtime connection (hub_app can read DemoMeta and pg_locks). Null when DemoMeta has no row yet. */
export async function readDemoState(client: Pick<PrismaClient, "$queryRaw"> = db): Promise<DemoState | null> {
  const rows = await client.$queryRaw<{ idleDue: boolean; restoreRunning: boolean; lastRestoreAt: Date | null }[]>`
    SELECT
      (m."lastWriteAt" IS NOT NULL AND m."lastWriteAt" < now() - make_interval(mins => ${IDLE_MINUTES}::int)) AS "idleDue",
      EXISTS (
        SELECT 1 FROM pg_locks
        WHERE locktype = 'advisory' AND granted AND ((classid::bigint << 32) | objid::bigint) = ${RESTORE_LOCK_KEY}::bigint
      ) AS "restoreRunning",
      m."lastRestoreAt" AS "lastRestoreAt"
    FROM "DemoMeta" m WHERE m."id" = 1`;
  if (rows.length === 0) return null;
  return { idleDue: rows[0].idleDue, restoreRunning: rows[0].restoreRunning, lastRestoreAtMs: rows[0].lastRestoreAt?.getTime() ?? null };
}

/** Whether the idle restore and its "Preparing" screen are active: the demo, with the admin connection the restore needs. */
export function idleRestoreEnabled(): boolean {
  return process.env.DEMO_MODE === "true" && !!process.env.DATABASE_ADMIN_URL;
}

/**
 * Records that a visitor changed data, now by the database's clock. Called after every successful write request (src/server/http.ts).
 * Best effort: a failure here must not fail the write that already committed; the daily restore is the backstop.
 */
export async function recordDataWrite(client: Pick<PrismaClient, "$executeRaw"> = db): Promise<void> {
  try {
    await client.$executeRaw`UPDATE "DemoMeta" SET "lastWriteAt" = clock_timestamp() WHERE "id" = 1`;
  } catch (err) {
    console.error("[demo-idle] could not record the write", err);
  }
}

/** The restore itself, dated from the default demo clock rather than the clock of whoever triggered it. Throws ConflictError when one is already running. */
export function runRestore() {
  return atFreshClock(() => restoreDemoData(createAdminDb));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The idle rule, run from the "Preparing" screen. A request that finds a restore running waits for it (polling the advisory lock);
 * when the data changed since the last restore and nobody wrote for IDLE_MINUTES, it runs the restore; otherwise it does nothing.
 * Never restores unless the rule holds, so it is safe to leave open to every visitor. `restored` is true only when this call ran it.
 */
export async function prepareDemo(
  options: { client?: Pick<PrismaClient, "$queryRaw">; restore?: () => Promise<unknown>; pollMs?: number; timeoutMs?: number } = {},
): Promise<{ restored: boolean; lastRestoreAtMs: number | null }> {
  const { client = db, restore = runRestore, pollMs = 250, timeoutMs = 120_000 } = options;
  const deadline = Date.now() + timeoutMs;
  let restored = false;
  for (;;) {
    const state = await readDemoState(client);
    if (!state) return { restored, lastRestoreAtMs: null };
    if (!state.restoreRunning && !state.idleDue) return { restored, lastRestoreAtMs: state.lastRestoreAtMs };
    if (Date.now() > deadline) throw new ConflictError("The demo is still being prepared. Try again in a few seconds.");
    if (state.restoreRunning) {
      await sleep(pollMs);
      continue;
    }
    try {
      await restore();
      restored = true;
    } catch (err) {
      if (!(err instanceof ConflictError)) throw err;
      await sleep(pollMs); // someone else took the lock between our read and our restore: wait for theirs
    }
  }
}

/** The cron request's Authorization header against CRON_SECRET ("Bearer <secret>", what Vercel Cron sends). Unset or empty CRON_SECRET never authorizes. */
export function cronAuthorized(authorization: string | null, secret = process.env.CRON_SECRET): boolean {
  if (!secret || !authorization) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(authorization);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
