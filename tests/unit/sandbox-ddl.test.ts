import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import sandboxDdl from "../../data/sandbox-ddl.js";
import { SANDBOX_SKIP_MARKER, buildSandboxDdl, sandboxDdlFile, sandboxDdlModule, stripGlobalStatements } from "../../scripts/sandbox-ddl-lib";

describe("the sandbox DDL is current", () => {
  it("matches the migrations and grants it was generated from", () => {
    const ddl = buildSandboxDdl();
    expect(
      sandboxDdl.ddlHash,
      "data/sandbox-ddl.js is stale: a migration or prisma/grants.sql changed. Run `npm run sandbox:ddl` and commit the result.",
    ).toBe(ddl.hash);
    expect(readFileSync("data/sandbox-ddl.sql", "utf-8"), "data/sandbox-ddl.sql is stale: run `npm run sandbox:ddl`").toBe(sandboxDdlFile(ddl));
    expect(readFileSync("data/sandbox-ddl.js", "utf-8"), "data/sandbox-ddl.js is stale: run `npm run sandbox:ddl`").toBe(sandboxDdlModule(ddl));
  });

  it("keeps everything a sandbox needs and nothing that must stay global", () => {
    const sql = sandboxDdl.sql;
    expect(sql).toContain('CREATE TABLE "Entity"');
    expect(sql).toContain("CREATE SEQUENCE IF NOT EXISTS issue_number_seq");
    expect(sql).toContain("CREATE FUNCTION audit_append_only()");
    expect(sql).toContain('CREATE TRIGGER "AuditEntry_append_only"');
    expect(sql).toContain('ALTER TABLE "DemoMeta" ADD COLUMN');
    expect(sql).not.toMatch(/CREATE\s+EXTENSION/i);
    expect(sql).not.toMatch(/CREATE\s+SCHEMA/i);
    expect(sql).not.toContain("DemoSandbox"); // the registry stays in public
    expect(sandboxDdl.grants).toContain("GRANT USAGE ON SCHEMA public TO hub_app");
  });
});

describe("stripGlobalStatements", () => {
  it("removes CREATE EXTENSION and CREATE SCHEMA statements and nothing else", () => {
    const out = stripGlobalStatements(['CREATE EXTENSION IF NOT EXISTS "pg_trgm";', 'create schema if not exists "public";', 'CREATE TABLE "A" ("id" TEXT);', 'CREATE INDEX "x" ON "A" USING GIN ("id" gin_trgm_ops);'].join("\n"));
    expect(out).not.toMatch(/EXTENSION|SCHEMA/i);
    expect(out).toContain('CREATE TABLE "A" ("id" TEXT);');
    expect(out).toContain("gin_trgm_ops");
  });
});

describe("buildSandboxDdl", () => {
  function fixture(migrations: Record<string, string>, grants = "GRANT USAGE ON SCHEMA public TO hub_app;"): string {
    const root = mkdtempSync(join(tmpdir(), "ddl-"));
    const dir = join(root, "migrations");
    mkdirSync(dir);
    writeFileSync(join(root, "grants.sql"), grants);
    for (const [name, sql] of Object.entries(migrations)) {
      mkdirSync(join(dir, name));
      writeFileSync(join(dir, name, "migration.sql"), sql);
    }
    return dir;
  }

  it("concatenates the migrations in name order and skips the ones marked as public-only", () => {
    const dir = fixture({
      "2_second": 'CREATE TABLE "B" ("id" TEXT);',
      "1_first": 'CREATE EXTENSION IF NOT EXISTS "pg_trgm";\nCREATE TABLE "A" ("id" TEXT);',
      "3_registry": `${SANDBOX_SKIP_MARKER}\nCREATE TABLE "DemoSandbox" ("id" TEXT);`,
    });
    const ddl = buildSandboxDdl(dir);
    expect(ddl.migrations).toEqual(["1_first", "2_second"]);
    expect(ddl.sql.indexOf('"A"')).toBeLessThan(ddl.sql.indexOf('"B"'));
    expect(ddl.sql).not.toContain("DemoSandbox");
    expect(ddl.sql).not.toContain("EXTENSION");
  });

  it("changes the hash when a migration or the grants change", () => {
    const a = buildSandboxDdl(fixture({ "1": "CREATE TABLE a (id int);" }));
    const sameAgain = buildSandboxDdl(fixture({ "1": "CREATE TABLE a (id int);" }));
    const migrationChanged = buildSandboxDdl(fixture({ "1": "CREATE TABLE a (id bigint);" }));
    const grantsChanged = buildSandboxDdl(fixture({ "1": "CREATE TABLE a (id int);" }, "GRANT USAGE ON SCHEMA public TO other;"));
    expect(sameAgain.hash).toBe(a.hash);
    expect(migrationChanged.hash).not.toBe(a.hash);
    expect(grantsChanged.hash).not.toBe(a.hash);
  });
});
