import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Client } from "pg";

/**
 * A throwaway database made from every migration, so a test can restore, truncate and write without touching the shared dev database the
 * other test files assert against. Needs DATABASE_ADMIN_URL (the local Docker owner role). `drop()` removes it.
 */
export async function createScratchDb(prefix: string): Promise<{ url: string; client: PrismaClient; drop: () => Promise<void> }> {
  const adminUrl = process.env.DATABASE_ADMIN_URL ?? "";
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(adminUrl)) throw new Error("Scratch databases are for local Docker only; DATABASE_ADMIN_URL must point at localhost.");
  const name = `${prefix}_${process.pid}`;
  const url = adminUrl.replace(/\/[^/?]+(\?|$)/, `/${name}$1`);

  const maintenance = async <T>(fn: (c: Client) => Promise<T>): Promise<T> => {
    const c = new Client({ connectionString: adminUrl });
    await c.connect();
    try {
      return await fn(c);
    } finally {
      await c.end();
    }
  };

  await maintenance((c) => c.query(`CREATE DATABASE "${name}"`));
  const c = new Client({ connectionString: url });
  await c.connect();
  const dir = resolve(__dirname, "../../../prisma/migrations");
  for (const m of readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()) {
    await c.query(readFileSync(resolve(dir, m, "migration.sql"), "utf-8"));
  }
  await c.end();

  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 1 }) });
  return {
    url,
    client,
    drop: async () => {
      await client.$disconnect();
      await maintenance((c) => c.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`));
    },
  };
}
