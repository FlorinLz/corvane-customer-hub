import "dotenv/config";

import type { PrismaClient } from "@prisma/client";
import { Client } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createScratchDb } from "./helpers/scratch-db";
import { IDLE_MINUTES, isIdleDue, needsPreparing, prepareDemo, readDemoState, recordDataWrite, type DemoState } from "@/server/demo-idle";
import { ConflictError } from "@/server/errors";
import { RESTORE_LOCK_KEY, restoreFromSnapshot } from "@/server/demo-reset";

const MIN = 60_000;

describe("the idle rule", () => {
  const now = Date.parse("2026-10-14T12:00:00Z");

  it("is 20 minutes", () => {
    expect(IDLE_MINUTES).toBe(20);
  });

  it("19 minutes without a write is not idle, 21 minutes is; no write since the restore is never idle", () => {
    expect(isIdleDue(now - 19 * MIN, now)).toBe(false);
    expect(isIdleDue(now - 21 * MIN, now)).toBe(true);
    expect(isIdleDue(null, now)).toBe(false);
  });
});

describe("needsPreparing: when a page request goes through the Preparing screen", () => {
  const fresh: DemoState = { idleDue: false, restoreRunning: false, lastRestoreAtMs: 1_000_000 };

  it("renders straight away when nothing is due, nothing runs and the visitor arrived after the last restore", () => {
    expect(needsPreparing(fresh, 1_000_001)).toBe(false);
    expect(needsPreparing(fresh, 1_000_000)).toBe(false); // an arrival equal to the restore is fine: it is what the Preparing screen sets
    expect(needsPreparing({ ...fresh, lastRestoreAtMs: null }, 5)).toBe(false);
  });

  it("prepares when a restore is due or running", () => {
    expect(needsPreparing({ ...fresh, idleDue: true }, 2_000_000)).toBe(true);
    expect(needsPreparing({ ...fresh, restoreRunning: true }, 2_000_000)).toBe(true);
  });

  it("prepares a visitor who arrived before the last restore, so their clock and the data start together", () => {
    expect(needsPreparing(fresh, 999_999)).toBe(true);
  });

  it("ignores arrival when there is no visitor clock", () => {
    expect(needsPreparing(fresh, undefined)).toBe(false);
  });
});

// The database part runs in a throwaway database (the restore truncates every table).
let scratch: PrismaClient;
let scratchUrl: string;
let dropScratch: () => Promise<void>;

const restoreHere = () => restoreFromSnapshot(scratchUrl);
const setLastWrite = (minutesAgo: number | null) =>
  minutesAgo === null
    ? scratch.$executeRaw`UPDATE "DemoMeta" SET "lastWriteAt" = NULL WHERE "id" = 1`
    : scratch.$executeRaw`UPDATE "DemoMeta" SET "lastWriteAt" = clock_timestamp() - make_interval(mins => ${minutesAgo}::int) WHERE "id" = 1`;

describe("the idle restore, on a real database", () => {
  beforeAll(async () => {
    const db = await createScratchDb("customer_hub_idle_test");
    scratch = db.client;
    scratchUrl = db.url;
    dropScratch = db.drop;
    await restoreHere();
  }, 60_000);

  afterAll(async () => {
    await dropScratch?.();
  });

  beforeEach(async () => {
    await scratch.$executeRaw`UPDATE "DemoMeta" SET "lastWriteAt" = NULL WHERE "id" = 1`;
  });

  it("a restore clears the last write and stamps the restore time", async () => {
    await recordDataWrite(scratch);
    expect((await scratch.demoMeta.findUniqueOrThrow({ where: { id: 1 } })).lastWriteAt).not.toBeNull();
    const before = Date.now();
    await restoreHere();
    const meta = await scratch.demoMeta.findUniqueOrThrow({ where: { id: 1 } });
    expect(meta.lastWriteAt).toBeNull();
    expect(meta.lastRestoreAt!.getTime()).toBeGreaterThanOrEqual(before - 1000);
  }, 60_000);

  it("recordDataWrite stamps the write time by the database's clock", async () => {
    await recordDataWrite(scratch);
    const state = await readDemoState(scratch);
    expect(state).toMatchObject({ idleDue: false, restoreRunning: false });
    const meta = await scratch.demoMeta.findUniqueOrThrow({ where: { id: 1 } });
    expect(Math.abs(meta.lastWriteAt!.getTime() - Date.now())).toBeLessThan(5_000);
  });

  it("19 minutes after the last write: no restore", async () => {
    await setLastWrite(19);
    expect((await readDemoState(scratch))!.idleDue).toBe(false);
    const restore = vi.fn(restoreHere);
    expect((await prepareDemo({ client: scratch, restore })).restored).toBe(false);
    expect(restore).not.toHaveBeenCalled();
  });

  it("21 minutes after the last write: restores once, and not again", async () => {
    await setLastWrite(21);
    expect((await readDemoState(scratch))!.idleDue).toBe(true);
    const version = (await scratch.demoMeta.findUniqueOrThrow({ where: { id: 1 } })).seedVersion;
    const restore = vi.fn(restoreHere);
    const first = await prepareDemo({ client: scratch, restore });
    expect(first.restored).toBe(true);
    expect(restore).toHaveBeenCalledTimes(1);
    const meta = await scratch.demoMeta.findUniqueOrThrow({ where: { id: 1 } });
    expect(meta.seedVersion).toBe(version + 1);
    expect(meta.lastWriteAt).toBeNull();
    expect(first.lastRestoreAtMs).toBe(meta.lastRestoreAt!.getTime());

    expect((await prepareDemo({ client: scratch, restore })).restored).toBe(false);
    expect(restore).toHaveBeenCalledTimes(1);
  }, 60_000);

  it("nothing written since the restore: no restore, however old the restore is", async () => {
    await scratch.$executeRaw`UPDATE "DemoMeta" SET "lastRestoreAt" = clock_timestamp() - interval '3 days' WHERE "id" = 1`;
    const restore = vi.fn(restoreHere);
    expect((await prepareDemo({ client: scratch, restore })).restored).toBe(false);
    expect(restore).not.toHaveBeenCalled();
  });

  it("a request that finds a restore running waits for it, then renders without restoring again", async () => {
    await setLastWrite(21);
    const holder = new Client({ connectionString: scratchUrl });
    await holder.connect();
    const restore = vi.fn(restoreHere);
    try {
      await holder.query("BEGIN");
      await holder.query(`SELECT pg_advisory_xact_lock(${RESTORE_LOCK_KEY})`); // a restore is running
      expect((await readDemoState(scratch))!.restoreRunning).toBe(true);

      let finished = false;
      const started = Date.now();
      const waiting = prepareDemo({ client: scratch, restore, pollMs: 50 }).then((r) => {
        finished = true;
        return r;
      });
      await new Promise((r) => setTimeout(r, 500));
      expect(finished).toBe(false); // still waiting
      expect(restore).not.toHaveBeenCalled();

      // The running restore finishes: data fresh, last write cleared, lock released.
      await holder.query(`UPDATE "DemoMeta" SET "lastWriteAt" = NULL, "lastRestoreAt" = clock_timestamp() WHERE "id" = 1`);
      await holder.query("COMMIT");

      const result = await waiting;
      expect(result.restored).toBe(false); // the other restore did the work
      expect(restore).not.toHaveBeenCalled();
      expect(Date.now() - started).toBeGreaterThanOrEqual(500);
    } finally {
      await holder.query("ROLLBACK").catch(() => undefined);
      await holder.end();
    }
  }, 30_000);

  it("gives up with a conflict when the running restore outlasts the timeout", async () => {
    const holder = new Client({ connectionString: scratchUrl });
    await holder.connect();
    try {
      await holder.query("BEGIN");
      await holder.query(`SELECT pg_advisory_xact_lock(${RESTORE_LOCK_KEY})`);
      await expect(prepareDemo({ client: scratch, restore: restoreHere, pollMs: 20, timeoutMs: 200 })).rejects.toBeInstanceOf(ConflictError);
    } finally {
      await holder.query("ROLLBACK");
      await holder.end();
    }
  });

  it("when another request wins the lock between the read and the restore, it waits for theirs", async () => {
    await setLastWrite(21);
    let calls = 0;
    const restore = vi.fn(async () => {
      calls += 1;
      if (calls === 1) {
        await restoreHere(); // the other request's restore, finishing first
        throw new ConflictError("A restore is already running.");
      }
    });
    const result = await prepareDemo({ client: scratch, restore, pollMs: 20 });
    expect(restore).toHaveBeenCalledTimes(1); // after the conflict the state is fresh, so no second attempt
    expect(result.restored).toBe(false);
  }, 60_000);
});
