import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { buildNeonRebuildSql } from "../../scripts/neon-rebuild-sql";

describe("scripts/neon-rebuild.sql", () => {
  const file = readFileSync("scripts/neon-rebuild.sql", "utf-8");

  it("is the generated file: run `npm run neon:rebuild-sql` after changing the baseline migration or prisma/grants.sql", () => {
    expect(file).toBe(buildNeonRebuildSql());
  });

  it("records the baseline in Prisma's history with the checksum of the migration file", () => {
    const sql = readFileSync("prisma/migrations/20261010000000_baseline/migration.sql", "utf-8");
    expect(file).toContain(createHash("sha256").update(sql).digest("hex"));
    expect(file).toContain("20261010000000_baseline");
  });

  it("holds no connection string or password", () => {
    expect(file).not.toMatch(/postgres(ql)?:\/\//i);
    expect(file).not.toMatch(/password\s+['"]/i); // no CREATE ROLE ... PASSWORD '...'
  });

  it("keeps every grant of prisma/grants.sql", () => {
    for (const line of readFileSync("prisma/grants.sql", "utf-8").split("\n").filter((l) => /^(GRANT|REVOKE)/.test(l))) expect(file).toContain(line.trim());
  });
});
