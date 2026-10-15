import "dotenv/config";

import { readFileSync } from "node:fs";

import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createScratchDb } from "./helpers/scratch-db";
import { normaliseCore, normaliseSearch } from "@/lib/validation/normalise";
import { demoSnapshot } from "@/server/demo-snapshot";

// The snapshot is only valid on the day it was made for; this suite runs under another demo clock, so say it applies.
vi.mock("@/server/demo-reset", async (original) => ({ ...(await original<typeof import("@/server/demo-reset")>()), snapshotApplies: () => true }));

type Sandbox = typeof import("@/server/sandbox");
type DbModule = typeof import("@/server/db");

let sandbox: Sandbox;
let dbModule: DbModule;
let admin: Pool;
let dropScratch: () => Promise<void>;
const created = new Set<string>();

const rows = async (sql: string, params: unknown[] = []) => (await admin.query(sql, params)).rows;
const rowCount = (table: string, schema: string) => admin.query(`SELECT count(*)::int AS n FROM "${schema}"."${table}"`).then((r) => r.rows[0].n as number);
const snapshotRows = (table: string) => demoSnapshot.tables.find((t) => t.name === table)!.rows.length;

async function track(schema: string): Promise<string> {
  created.add(schema);
  return schema;
}

beforeAll(async () => {
  const scratch = await createScratchDb("customer_hub_sandbox_test");
  dropScratch = scratch.drop;
  await scratch.client.$disconnect();
  admin = new Pool({ connectionString: scratch.url, max: 2 });
  await admin.query(readFileSync("prisma/grants.sql", "utf-8")); // the grants a real database has; the sandboxes' own come from the DDL module

  const appUrl = scratch.url.replace(/\/\/[^@]+@/, "//hub_app:hub_app@");
  vi.stubEnv("DATABASE_URL", appUrl);
  vi.stubEnv("DATABASE_ADMIN_URL", scratch.url);
  vi.stubEnv("DEMO_MODE", "true");
  vi.stubEnv("DEMO_SANDBOXES", "true");
  vi.stubEnv("DEMO_SANDBOX_SPARES", "1");
  vi.stubEnv("DEMO_SANDBOX_MAX", "6");
  vi.stubEnv("SESSION_SECRET", "s".repeat(40));
  const g = globalThis as Record<string, unknown>;
  for (const key of ["__corvanePool", "__corvanePublicDb", "__corvaneSandboxDbs", "__corvaneAdminPool"]) delete g[key];
  vi.resetModules();
  sandbox = await import("@/server/sandbox");
  dbModule = await import("@/server/db");
}, 60_000);

afterAll(async () => {
  const g = globalThis as unknown as Record<string, { end?: () => Promise<void> } | undefined>;
  await g.__corvaneAdminPool?.end?.();
  await g.__corvanePool?.end?.();
  await admin?.end();
  await dropScratch?.();
  vi.unstubAllEnvs();
});

describe("a new sandbox", () => {
  let schema: string;

  it("is built in its own schema from the DDL, the snapshot and the grants", async () => {
    const acquired = await sandbox.acquireSandbox(Date.now());
    schema = await track(acquired.schema);
    expect(acquired.source).toBe("created"); // no spare was ready
    expect(await rowCount("Entity", schema)).toBe(snapshotRows("Entity"));
    expect(await rowCount("Issue", schema)).toBe(snapshotRows("Issue"));
    // pg_trgm stayed in public once; the sandbox did not get its own copy
    expect(await rows(`SELECT extnamespace::regnamespace::text AS ns FROM pg_extension WHERE extname = 'pg_trgm'`)).toEqual([{ ns: "public" }]);
    expect(await rows(`SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = $1 AND p.proname LIKE 'similarity%'`, [schema])).toEqual([]);
  }, 60_000);

  it("has its own issue number sequence, and the Issue column default uses it", async () => {
    expect(await rows(`SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = $1 AND c.relname = 'issue_number_seq' AND c.relkind = 'S'`, [schema])).toHaveLength(1);
    const [{ def }] = await rows(
      `SELECT pg_get_expr(d.adbin, d.adrelid) AS def FROM pg_attrdef d JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
       WHERE d.adrelid = ($1 || '."Issue"')::regclass AND a.attname = 'number'`,
      [`"${schema}"`],
    );
    expect(def).toContain(`${schema}.issue_number_seq`);
    const [{ next }] = await rows(`SELECT nextval('"${schema}".issue_number_seq') AS next`);
    expect(Number(next)).toBe(demoSnapshot.issueNumberNext); // setval put the sandbox's own sequence where the snapshot says
    expect(await rows(`SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'issue_number_seq'`)).toHaveLength(1);
  });

  it("has its audit id sequence past the restored rows, so the first audited write does not collide", async () => {
    const [{ maxId }] = await rows(`SELECT max("id")::bigint AS "maxId" FROM "${schema}"."AuditEntry"`);
    expect(Number(maxId)).toBeGreaterThan(0);
    const [{ next }] = await rows(`SELECT nextval(pg_get_serial_sequence('"${schema}"."AuditEntry"', 'id')) AS next`);
    expect(Number(next)).toBe(Number(maxId) + 1);
  });

  it("has the append-only trigger and function in the sandbox, and the trigger fires", async () => {
    expect(await rows(`SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = $1 AND p.proname = 'audit_append_only'`, [schema])).toHaveLength(1);
    const triggers = await rows(
      `SELECT t.tgname, t.tgfoid::regproc::text AS fn FROM pg_trigger t WHERE t.tgrelid = ($1 || '."AuditEntry"')::regclass AND NOT t.tgisinternal`,
      [`"${schema}"`],
    );
    expect(triggers).toEqual([{ tgname: "AuditEntry_append_only", fn: `${schema}.audit_append_only` }]);
    await expect(admin.query(`UPDATE "${schema}"."AuditEntry" SET "field" = 'x'`)).rejects.toThrow(/append-only/);
  });

  it("gives hub_app what grants.sql gives it on public, on the sandbox only", async () => {
    const priv = async (table: string, p: string) => (await rows(`SELECT has_table_privilege('hub_app', $1, $2) AS ok`, [`"${schema}"."${table}"`, p]))[0].ok;
    expect(await priv("Entity", "SELECT")).toBe(true);
    expect(await priv("Entity", "UPDATE")).toBe(true);
    expect(await priv("Entity", "DELETE")).toBe(false);
    expect(await priv("EntityAlias", "DELETE")).toBe(true);
    expect(await priv("AuditEntry", "INSERT")).toBe(true);
    expect(await priv("AuditEntry", "UPDATE")).toBe(false); // M16 AC3
    expect(await priv("IssueNote", "UPDATE")).toBe(false);
    expect((await rows(`SELECT has_schema_privilege('hub_app', $1, 'USAGE') AS ok`, [schema]))[0].ok).toBe(true);
    expect((await rows(`SELECT has_sequence_privilege('hub_app', $1, 'USAGE') AS ok`, [`"${schema}".issue_number_seq`]))[0].ok).toBe(true);
  });

  it("is registered, assigned, and expires 24 hours after the arrival", async () => {
    const [row] = await rows(`SELECT * FROM public."DemoSandbox" WHERE "schemaName" = $1`, [schema]);
    expect(row.status).toBe("ASSIGNED");
    expect(row.ddlHash).toBe(sandbox.DDL_HASH);
    expect(row.snapshotHash).toBe(sandbox.SNAPSHOT_HASH);
    expect(row.expiresAt.getTime() - Date.now()).toBeGreaterThan(23.9 * 3600_000);
    expect(row.expiresAt.getTime() - Date.now()).toBeLessThan(24.1 * 3600_000);
  });
});

describe("two sandboxes", () => {
  it("do not see each other's changes, through Prisma and through raw SQL", async () => {
    const { runInSandbox } = await import("@/server/sandbox-context");
    const { runSearch } = await import("@/server/queries/search");
    const { checkDuplicates } = await import("@/server/duplicates");
    const { db } = dbModule;
    const a = await track((await sandbox.acquireSandbox()).schema);
    const b = await track((await sandbox.acquireSandbox()).schema);

    const lloyds = await runInSandbox(a, () => db.entity.findFirstOrThrow({ where: { legalName: { contains: "Lloyds" } }, select: { id: true, legalName: true } }));
    const renamed = "Renamed in sandbox A plc";
    await runInSandbox(a, () =>
      db.entity.update({ where: { id: lloyds.id }, data: { legalName: renamed, legalNameSearch: normaliseSearch(renamed), legalNameCore: normaliseCore(renamed) } }),
    );

    expect((await runInSandbox(a, () => db.entity.findUniqueOrThrow({ where: { id: lloyds.id } }))).legalName).toBe("Renamed in sandbox A plc");
    expect((await runInSandbox(b, () => db.entity.findUniqueOrThrow({ where: { id: lloyds.id } }))).legalName).toBe(lloyds.legalName);
    expect(await rows(`SELECT 1 FROM public."Entity"`)).toEqual([]); // the public schema here is empty and stays untouched

    // Raw SQL (search, with the pg_trgm index and operators; the duplicate check, with a transaction-local similarity threshold) reads the visitor's own schema.
    const inA = await runInSandbox(a, () => runSearch({ q: "Renamed in sandbox", countries: [], schemes: [], page: 1 }));
    const inB = await runInSandbox(b, () => runSearch({ q: "Renamed in sandbox", countries: [], schemes: [], page: 1 }));
    expect(inA.rows.map((r) => r.id)).toEqual([lloyds.id]);
    expect(inB.rows).toEqual([]);
    expect((await runInSandbox(b, () => runSearch({ q: "Lloyds", countries: [], schemes: [], page: 1 }))).total).toBeGreaterThan(0);

    const dupes = await runInSandbox(a, () => checkDuplicates({ legalName: "Renamed in sandbox A plc", bics: [], aliases: [] }));
    expect(dupes.map((d) => d.entityId)).toContain(lloyds.id);
    expect(await runInSandbox(b, () => checkDuplicates({ legalName: "Renamed in sandbox A plc", bics: [], aliases: [] }))).toEqual([]);
  }, 60_000);

  it("keep their own issue numbers", async () => {
    const [a, b] = [...created].slice(-2);
    const [{ n1 }] = await rows(`SELECT nextval('"${a}".issue_number_seq') AS n1`);
    const [{ n2 }] = await rows(`SELECT nextval('"${b}".issue_number_seq') AS n2`);
    expect(Number(n1)).toBe(Number(n2)); // both started where the snapshot says, neither moved the other
  });

  it("outside a request, or on the shared fallback, use the public schema", async () => {
    const { currentSandboxSchema } = await import("@/server/sandbox-context");
    expect(currentSandboxSchema()).toBeUndefined();
    expect(await dbModule.db.entity.count()).toBe(0); // the empty public schema of this scratch database
  });
});

describe("spares", () => {
  it("refill to DEMO_SANDBOX_SPARES, and a new visitor claims one for their own 24 hours", async () => {
    expect(await sandbox.refillSpares()).toBe(1);
    expect(await sandbox.refillSpares()).toBe(0); // already enough
    const [spare] = await rows(`SELECT "schemaName" FROM public."DemoSandbox" WHERE "status" = 'SPARE'`);
    created.add(spare.schemaName);

    const arrival = Date.now() + 1000;
    const claimed = await sandbox.acquireSandbox(arrival);
    expect(claimed).toEqual({ schema: spare.schemaName, source: "spare" });
    const [row] = await rows(`SELECT status, "expiresAt" FROM public."DemoSandbox" WHERE "schemaName" = $1`, [spare.schemaName]);
    expect(row.status).toBe("ASSIGNED");
    expect(row.expiresAt.getTime()).toBe(arrival + 24 * 3600_000);
  }, 60_000);

  it("are never given to two visitors at once", async () => {
    expect(await sandbox.refillSpares()).toBe(1);
    const [spare] = await rows(`SELECT "schemaName" FROM public."DemoSandbox" WHERE "status" = 'SPARE'`);
    created.add(spare.schemaName);
    const results = await Promise.all([sandbox.acquireSandbox(), sandbox.acquireSandbox()]);
    for (const r of results) created.add(r.schema);
    expect(new Set(results.map((r) => r.schema)).size).toBe(2);
    expect(results.filter((r) => r.source === "spare")).toHaveLength(1);
  }, 60_000);
});

describe("the cap", () => {
  it("stops new sandboxes at DEMO_SANDBOX_MAX and says why", async () => {
    const [{ n }] = await rows(`SELECT count(*)::int AS n FROM public."DemoSandbox"`);
    vi.stubEnv("DEMO_SANDBOX_MAX", String(n));
    await expect(sandbox.acquireSandbox()).rejects.toBeInstanceOf(sandbox.SandboxUnavailableError);
    await expect(sandbox.acquireSandbox()).rejects.toThrow(/limit is reached/);
    expect(await sandbox.refillSpares()).toBe(0); // spares do not go past the cap either
    vi.stubEnv("DEMO_SANDBOX_MAX", "6");
  }, 60_000);
});

describe("start over", () => {
  it("puts the sandbox back to the snapshot, bumps seedVersion and renews the 24 hours", async () => {
    const [schema] = [...created];
    const { runInSandbox } = await import("@/server/sandbox-context");
    const { db } = dbModule;
    const before = await runInSandbox(schema, () => db.demoMeta.findUniqueOrThrow({ where: { id: 1 } }));
    await admin.query(`DELETE FROM "${schema}"."IssueNote"`);
    await admin.query(`UPDATE "${schema}"."Entity" SET "legalName" = 'changed'`);

    const arrival = Date.now() + 5000;
    const seedVersion = await sandbox.restoreSandbox(schema, arrival);
    expect(seedVersion).toBe(before.seedVersion + 1);
    expect(await rows(`SELECT 1 FROM "${schema}"."Entity" WHERE "legalName" = 'changed'`)).toEqual([]);
    expect(await rowCount("IssueNote", schema)).toBe(snapshotRows("IssueNote"));
    const [{ next }] = await rows(`SELECT nextval('"${schema}".issue_number_seq') AS next`);
    expect(Number(next)).toBe(demoSnapshot.issueNumberNext);
    const [row] = await rows(`SELECT "expiresAt" FROM public."DemoSandbox" WHERE "schemaName" = $1`, [schema]);
    expect(row.expiresAt.getTime()).toBe(arrival + 24 * 3600_000);
  }, 60_000);

  it("will not restore a sandbox that is not registered, or a name that is not a sandbox", async () => {
    await expect(sandbox.restoreSandbox("sbx_0000000000000000")).rejects.toThrow(/no longer registered/);
    await expect(sandbox.restoreSandbox("public")).rejects.toThrow("Invalid sandbox schema name");
  });
});

describe("cleanup", () => {
  it("drops expired sandboxes, spares with an old hash and orphan schemas, and nothing else", async () => {
    const [expired, keep] = [...created];
    await admin.query(`UPDATE public."DemoSandbox" SET "expiresAt" = now() - interval '1 minute' WHERE "schemaName" = $1`, [expired]);

    // a spare made from an older DDL
    const stale = sandbox.newSchemaName();
    await admin.query(`CREATE SCHEMA "${stale}"`);
    await admin.query(
      `INSERT INTO public."DemoSandbox" ("schemaName", "status", "expiresAt", "ddlHash", "snapshotHash") VALUES ($1, 'SPARE', now() + interval '1 day', 'old', $2)`,
      [stale, sandbox.SNAPSHOT_HASH],
    );
    // an orphan: a schema with the pattern and no registry row
    const orphan = sandbox.newSchemaName();
    await admin.query(`CREATE SCHEMA "${orphan}"`);
    // a schema that only looks similar, and a registry row whose schema is gone
    await admin.query(`CREATE SCHEMA sbx_not_a_sandbox`);
    const dangling = sandbox.newSchemaName();
    await admin.query(
      `INSERT INTO public."DemoSandbox" ("schemaName", "status", "expiresAt", "ddlHash", "snapshotHash") VALUES ($1, 'ASSIGNED', now() + interval '1 day', $2, $3)`,
      [dangling, sandbox.DDL_HASH, sandbox.SNAPSHOT_HASH],
    );

    const result = await sandbox.cleanupSandboxes();
    expect(result.expired).toEqual([expired]);
    expect(result.stale).toEqual([stale]);
    expect(result.orphans).toEqual([orphan]);
    expect(result.dangling).toEqual([dangling]);

    const schemas = (await rows(`SELECT nspname FROM pg_namespace WHERE nspname LIKE 'sbx\\_%'`)).map((r) => r.nspname as string);
    expect(schemas).toContain(keep);
    expect(schemas).toContain("sbx_not_a_sandbox");
    for (const gone of [expired, stale, orphan]) expect(schemas).not.toContain(gone);
    expect(await rows(`SELECT 1 FROM public."DemoSandbox" WHERE "schemaName" = ANY($1)`, [[expired, stale, dangling]])).toEqual([]);
    expect(await rows(`SELECT 1 FROM public."DemoSandbox" WHERE "schemaName" = $1`, [keep])).toHaveLength(1);
    await admin.query(`DROP SCHEMA sbx_not_a_sandbox`);
  }, 60_000);

  it("drops at most `limit` expired sandboxes at a time", async () => {
    const live = [...created].filter((s) => s !== [...created][0]).slice(0, 3);
    await admin.query(`UPDATE public."DemoSandbox" SET "expiresAt" = now() - interval '1 minute' WHERE "schemaName" = ANY($1)`, [live]);
    expect(await sandbox.dropExpiredSandboxes(2)).toHaveLength(2);
    expect(await sandbox.dropExpiredSandboxes(3)).toHaveLength(1);
    expect(await sandbox.dropExpiredSandboxes(3)).toEqual([]);
  }, 60_000);

  it("refuses a name that is not a sandbox", async () => {
    await expect(sandbox.dropSandbox("public")).rejects.toThrow("Invalid sandbox schema name");
    await expect(sandbox.dropSandbox('sbx_0123456789abcdef"; DROP SCHEMA public CASCADE; --')).rejects.toThrow();
    expect(await rows(`SELECT 1 FROM pg_namespace WHERE nspname = 'public'`)).toHaveLength(1);
  });
});
