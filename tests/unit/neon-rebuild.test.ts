import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { buildNeonRebuildSql } from "../../scripts/neon-rebuild-sql";

describe("scripts/neon-rebuild.sql", () => {
  const file = readFileSync("scripts/neon-rebuild.sql", "utf-8");

  it("is the generated file: run `npm run neon:rebuild-sql` after adding a migration or changing prisma/grants.sql", () => {
    expect(file).toBe(buildNeonRebuildSql());
  });

  it("records every migration in Prisma's history with the checksum of its file", () => {
    const names = readdirSync("prisma/migrations", { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
    expect(names.length).toBeGreaterThan(1);
    for (const name of names) {
      const sql = readFileSync(`prisma/migrations/${name}/migration.sql`, "utf-8");
      expect(file).toContain(createHash("sha256").update(sql).digest("hex"));
      expect(file).toContain(`'${name}'`);
    }
  });

  it("holds no connection string or password", () => {
    expect(file).not.toMatch(/postgres(ql)?:\/\//i);
    expect(file).not.toMatch(/password\s+['"]/i); // no CREATE ROLE ... PASSWORD '...'
  });

  it("keeps every grant of prisma/grants.sql", () => {
    for (const line of readFileSync("prisma/grants.sql", "utf-8").split("\n").filter((l) => /^(GRANT|REVOKE)/.test(l))) expect(file).toContain(line.trim());
  });
});
