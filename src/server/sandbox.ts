import { createHash, randomBytes } from "node:crypto";

import { Pool, type PoolClient } from "pg";

import sandboxDdl from "../../data/sandbox-ddl.js";
import { SANDBOX_LIFETIME_MS, assertSandboxSchemaName, grantsForSandbox, sandboxExpired, sandboxExpiresAtMs, sandboxSearchPath } from "@/lib/sandbox";
import { buildRestoreSql, demoSnapshot } from "@/server/demo-snapshot";
import { snapshotApplies } from "@/server/demo-reset";
import { ConflictError } from "@/server/errors";
import { poolConfig } from "@/server/pool-config";
import { atFreshClock } from "@/server/request-clock";
import { sandboxMax, sandboxSpares } from "@/server/sandbox-config";

/**
 * One Postgres schema per visitor on the same database (DECISIONS.md "Sandbox per visitor"). This file makes, claims, restores and drops them. It talks
 * to Postgres with plain `pg` on the admin connection (hub_owner): schema DDL needs the owner role, and the registry (public."DemoSandbox") is not a
 * table a sandbox-scoped Prisma client could reach.
 */

export const DDL_HASH = sandboxDdl.ddlHash;
/** Changes when the snapshot changes: a sandbox made from an older snapshot is out of date. */
export const SNAPSHOT_HASH = createHash("sha256").update(`${demoSnapshot.inputHash}:${demoSnapshot.seedToday}`).digest("hex");

/** Arbitrary constants: the advisory locks of sandbox housekeeping. */
const REFILL_LOCK_KEY = 7_315_042_002;

export class SandboxUnavailableError extends Error {}

// ---------- connections ----------

const globals = globalThis as { __corvaneAdminPool?: Pool };

/** One admin pool per instance, shared by every sandbox operation. Two connections: an inline creation and a background refill can overlap. */
function adminPool(): Pool {
  if (!process.env.DATABASE_ADMIN_URL) throw new SandboxUnavailableError("DATABASE_ADMIN_URL is not set");
  return (globals.__corvaneAdminPool ??= new Pool({ ...poolConfig(process.env.DATABASE_ADMIN_URL), max: 2 }));
}

async function inTransaction<T>(fn: (client: PoolClient) => Promise<T>, pool: Pool = adminPool()): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    try {
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw err;
    }
  } finally {
    client.release();
  }
}

// ---------- making a sandbox ----------

/** `sbx_` plus 16 hex characters from the server's random source. The only place a schema name is made. */
export function newSchemaName(): string {
  return `sbx_${randomBytes(8).toString("hex")}`;
}

export interface CreatePhases {
  schemaMs: number;
  ddlMs: number;
  snapshotMs: number;
  grantsMs: number;
  totalMs: number;
}

/** The first seedVersion of a new sandbox: the clock, in seconds. Browsers remember scenario progress per seedVersion, so a new sandbox must not repeat the last one's. */
function initialSeedVersion(nowMs: number): number {
  return Math.floor(nowMs / 1000);
}

/**
 * Builds a sandbox inside the caller's transaction: the schema, the DDL (with the search_path on `<sandbox>, public`, so every unqualified object lands
 * in the sandbox while pg_trgm's operator classes still resolve from public), the snapshot, the grants rewritten for the schema and the sequence position.
 * Does not touch the registry. `client` must be in a transaction.
 */
export async function buildSandboxSchema(client: PoolClient, schema: string, nowMs: number = Date.now()): Promise<CreatePhases> {
  assertSandboxSchemaName(schema);
  const t0 = performance.now();
  await client.query(`CREATE SCHEMA "${schema}"`);
  await client.query("SELECT set_config('search_path', $1, true)", [sandboxSearchPath(schema)]);
  const t1 = performance.now();
  await client.query(sandboxDdl.sql);
  const t2 = performance.now();
  // The same SQL as the public restore (src/server/demo-snapshot.ts), ending with setval on the sandbox's own issue_number_seq.
  await client.query(buildRestoreSql(demoSnapshot));
  await client.query(`INSERT INTO "DemoMeta" ("id", "seedVersion", "lastRestoreAt") VALUES (1, ${initialSeedVersion(nowMs)}, clock_timestamp())`);
  const t3 = performance.now();
  await client.query(grantsForSandbox(sandboxDdl.grants, schema));
  const t4 = performance.now();
  return { schemaMs: t1 - t0, ddlMs: t2 - t1, snapshotMs: t3 - t2, grantsMs: t4 - t3, totalMs: t4 - t0 };
}

/** Throws when the snapshot cannot be restored today (it is only valid on the day it was generated for, with cache-only GLEIF), judged from the default demo clock. */
async function assertSnapshotApplies(): Promise<void> {
  if (!(await atFreshClock(async () => snapshotApplies()))) throw new SandboxUnavailableError("the demo snapshot does not apply today (clock, GLEIF source or cache path)");
}

// ---------- the registry ----------

export type SandboxStatus = "SPARE" | "ASSIGNED";

async function countSandboxes(client: Pick<PoolClient, "query">): Promise<number> {
  const res = await client.query(`SELECT count(*)::int AS n FROM public."DemoSandbox"`);
  return res.rows[0].n as number;
}

/** Makes a sandbox and its registry row in one transaction. `expiresAtMs`: a spare lives one lifetime from now; an assigned sandbox, from the visitor's arrival. */
async function createSandbox(status: SandboxStatus, arrivalMs: number): Promise<{ schema: string; phases: CreatePhases }> {
  await assertSnapshotApplies();
  const schema = newSchemaName();
  const phases = await inTransaction(async (client) => {
    const built = await buildSandboxSchema(client, schema, arrivalMs);
    await client.query(
      `INSERT INTO public."DemoSandbox" ("schemaName", "status", "assignedAt", "expiresAt", "ddlHash", "snapshotHash")
       VALUES ($1, $2::public."DemoSandboxStatus", $3, $4, $5, $6)`,
      [schema, status, status === "ASSIGNED" ? new Date() : null, new Date(sandboxExpiresAtMs(arrivalMs)), DDL_HASH, SNAPSHOT_HASH],
    );
    return built;
  });
  return { schema, phases };
}

/** Claims a ready spare for a visitor who arrived at `arrivalMs`, or null when none is ready. SKIP LOCKED: two visitors never get the same one. */
async function claimSpare(arrivalMs: number): Promise<string | null> {
  const res = await adminPool().query(
    `UPDATE public."DemoSandbox" SET "status" = 'ASSIGNED', "assignedAt" = now(), "expiresAt" = $3
     WHERE "schemaName" = (
       SELECT "schemaName" FROM public."DemoSandbox"
       WHERE "status" = 'SPARE' AND "ddlHash" = $1 AND "snapshotHash" = $2 AND "expiresAt" > now()
       ORDER BY "createdAt" LIMIT 1 FOR UPDATE SKIP LOCKED
     ) RETURNING "schemaName"`,
    [DDL_HASH, SNAPSHOT_HASH, new Date(sandboxExpiresAtMs(arrivalMs))],
  );
  return res.rows[0]?.schemaName ?? null;
}

export interface Acquired {
  schema: string;
  source: "spare" | "created";
  createMs?: number;
}

/**
 * A sandbox for a visitor arriving now: a ready spare when there is one, otherwise one made on the spot (the "Preparing" screen covers the wait).
 * Throws SandboxUnavailableError at the cap (DEMO_SANDBOX_MAX) and whatever Postgres throws on a failed creation; the caller falls back to the shared demo.
 */
export async function acquireSandbox(arrivalMs: number = Date.now()): Promise<Acquired> {
  const spare = await claimSpare(arrivalMs);
  if (spare) return { schema: spare, source: "spare" };

  let total = await countSandboxes(adminPool());
  if (total >= sandboxMax()) {
    await dropExpiredSandboxes(3);
    total = await countSandboxes(adminPool());
    if (total >= sandboxMax()) throw new SandboxUnavailableError(`the sandbox limit is reached (${total} of ${sandboxMax()})`);
  }
  const t0 = performance.now();
  const { schema } = await createSandbox("ASSIGNED", arrivalMs);
  return { schema, source: "created", createMs: performance.now() - t0 };
}

/**
 * Keeps DEMO_SANDBOX_SPARES ready sandboxes. Safe to call from every request's `after()`: one advisory lock decides who refills, and the count is taken
 * under it. Never goes past the cap. Returns how many it made.
 */
export async function refillSpares(): Promise<number> {
  const wanted = sandboxSpares();
  let made = 0;
  for (;;) {
    const done = await inTransaction(async (client) => {
      const lock = await client.query("SELECT pg_try_advisory_xact_lock($1) AS locked", [REFILL_LOCK_KEY]);
      if (!lock.rows[0].locked) return true;
      const spares = await client.query(
        `SELECT count(*)::int AS n FROM public."DemoSandbox" WHERE "status" = 'SPARE' AND "ddlHash" = $1 AND "snapshotHash" = $2 AND "expiresAt" > now()`,
        [DDL_HASH, SNAPSHOT_HASH],
      );
      if (spares.rows[0].n >= wanted || (await countSandboxes(client)) >= sandboxMax()) return true;
      await assertSnapshotApplies();
      const schema = newSchemaName();
      await buildSandboxSchema(client, schema);
      await client.query(
        `INSERT INTO public."DemoSandbox" ("schemaName", "status", "expiresAt", "ddlHash", "snapshotHash") VALUES ($1, 'SPARE', $2, $3, $4)`,
        [schema, new Date(Date.now() + SANDBOX_LIFETIME_MS), DDL_HASH, SNAPSHOT_HASH],
      );
      return false;
    });
    if (done) return made;
    made += 1;
  }
}

// ---------- the visitor's own sandbox ----------

export interface SandboxRow {
  schemaName: string;
  status: SandboxStatus;
  expiresAt: Date;
  ddlHash: string;
  snapshotHash: string;
}

/**
 * Whether a registry row is still the right sandbox for a visitor who arrived at `arrivalMs` (undefined when the demo clock is off): assigned, not
 * expired, made from today's DDL and snapshot, and expiring 24 h after that arrival, so the data and the clock started together.
 */
export function sandboxUsable(row: SandboxRow | undefined, arrivalMs: number | undefined, nowMs: number = Date.now()): boolean {
  if (!row || row.status !== "ASSIGNED") return false;
  if (row.ddlHash !== DDL_HASH || row.snapshotHash !== SNAPSHOT_HASH) return false;
  if (sandboxExpired(row.expiresAt.getTime(), nowMs)) return false;
  return arrivalMs === undefined || Math.abs(row.expiresAt.getTime() - sandboxExpiresAtMs(arrivalMs)) < 1000;
}

/** Start over: the visitor's own schema back to the snapshot (same restore SQL, search_path on the sandbox), seedVersion + 1, and a new 24 h from `arrivalMs`. */
export async function restoreSandbox(schema: string, arrivalMs: number = Date.now()): Promise<number> {
  assertSandboxSchemaName(schema);
  await assertSnapshotApplies();
  return inTransaction(async (client) => {
    const lock = await client.query("SELECT pg_try_advisory_xact_lock(hashtext($1)) AS locked", [schema]);
    if (!lock.rows[0].locked) throw new ConflictError("A restart is already running. Try again in a few seconds.");
    const registry = await client.query(
      `UPDATE public."DemoSandbox" SET "expiresAt" = $2, "assignedAt" = now() WHERE "schemaName" = $1 AND "status" = 'ASSIGNED' RETURNING 1`,
      [schema, new Date(sandboxExpiresAtMs(arrivalMs))],
    );
    if (registry.rowCount === 0) throw new SandboxUnavailableError("this sandbox is no longer registered");
    await client.query("SELECT set_config('search_path', $1, true)", [sandboxSearchPath(schema)]);
    await client.query(buildRestoreSql(demoSnapshot));
    const meta = await client.query(
      `INSERT INTO "DemoMeta" ("id", "seedVersion", "lastRestoreAt") VALUES (1, ${initialSeedVersion(arrivalMs)}, clock_timestamp())
       ON CONFLICT ("id") DO UPDATE SET "seedVersion" = "DemoMeta"."seedVersion" + 1, "lastWriteAt" = NULL, "lastRestoreAt" = clock_timestamp() RETURNING "seedVersion"`,
    );
    return meta.rows[0].seedVersion as number;
  });
}

// ---------- dropping ----------

/** Drops one sandbox schema and its registry row. Takes a name that passes the format check only. */
export async function dropSandbox(schema: string, pool: Pool = adminPool()): Promise<void> {
  assertSandboxSchemaName(schema);
  await inTransaction(async (client) => {
    await client.query("SET LOCAL lock_timeout = '10s'");
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await client.query(`DELETE FROM public."DemoSandbox" WHERE "schemaName" = $1`, [schema]);
  }, pool);
}

/** Drops up to `limit` sandboxes whose 24 h are over. Returns the names dropped. Errors on one sandbox are logged and the rest go on. */
export async function dropExpiredSandboxes(limit: number): Promise<string[]> {
  const rows = await adminPool().query(`SELECT "schemaName" FROM public."DemoSandbox" WHERE "expiresAt" <= now() ORDER BY "expiresAt" LIMIT $1`, [limit]);
  return dropAll(rows.rows.map((r) => r.schemaName as string));
}

async function dropAll(names: string[]): Promise<string[]> {
  const dropped: string[] = [];
  for (const name of names) {
    try {
      await dropSandbox(name);
      dropped.push(name);
    } catch (err) {
      console.error(`[sandbox] could not drop ${name}`, err);
    }
  }
  return dropped;
}

export interface CleanupResult {
  expired: string[];
  stale: string[];
  orphans: string[];
  dangling: string[];
}

/**
 * The daily cleanup: expired sandboxes; spares made from an old DDL or snapshot (assigned ones are left to expire, the visitor is in them); schemas that
 * match the sandbox pattern but have no registry row; registry rows whose schema is gone.
 */
export async function cleanupSandboxes(): Promise<CleanupResult> {
  const pool = adminPool();
  const expired = await dropAll((await pool.query(`SELECT "schemaName" FROM public."DemoSandbox" WHERE "expiresAt" <= now()`)).rows.map((r) => r.schemaName));
  const stale = await dropAll(
    (await pool.query(`SELECT "schemaName" FROM public."DemoSandbox" WHERE "status" = 'SPARE' AND ("ddlHash" <> $1 OR "snapshotHash" <> $2)`, [DDL_HASH, SNAPSHOT_HASH])).rows.map((r) => r.schemaName),
  );
  const orphanRows = await pool.query(
    `SELECT nspname FROM pg_namespace WHERE nspname ~ '^sbx_[0-9a-f]{16}$' AND nspname NOT IN (SELECT "schemaName" FROM public."DemoSandbox")`,
  );
  const orphans = await dropAll(orphanRows.rows.map((r) => r.nspname as string));
  const danglingRows = await pool.query(
    `SELECT "schemaName" FROM public."DemoSandbox" WHERE "schemaName" NOT IN (SELECT nspname FROM pg_namespace)`,
  );
  const dangling: string[] = [];
  for (const r of danglingRows.rows) {
    await pool.query(`DELETE FROM public."DemoSandbox" WHERE "schemaName" = $1`, [r.schemaName]);
    dangling.push(r.schemaName);
  }
  return { expired, stale, orphans, dangling };
}

/** What each new sandbox does in the background: drop up to 3 expired ones, then top the spares up. Never throws. */
export async function sandboxHousekeeping(): Promise<void> {
  try {
    await dropExpiredSandboxes(3);
    await refillSpares();
  } catch (err) {
    console.error("[sandbox] housekeeping failed", err);
  }
}
