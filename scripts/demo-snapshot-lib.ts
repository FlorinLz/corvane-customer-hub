import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import type { PrismaClient } from "@prisma/client";

import type { DemoSnapshot } from "../src/server/demo-snapshot";

const ROOT = resolve(__dirname, "..");

/** The default demo clock; also the snapshot's. Mon 05 Oct 2026, 10:05 CEST. */
export const SNAPSHOT_CLOCK_START = "2026-10-05T10:05:00+02:00";

function resolveImport(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = join(ROOT, "src", spec.slice(2));
  else if (spec.startsWith("@seed/")) base = join(ROOT, "prisma/seed", spec.slice(6));
  else if (spec.startsWith(".")) base = resolve(dirname(from), spec);
  else return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}.json`, join(base, "index.ts")]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** Every file the seed pulls in, found by following its imports. */
function seedImportClosure(): string[] {
  const seen = new Set<string>();
  const queue = [join(ROOT, "prisma/seed/seed.ts"), join(ROOT, "prisma/seed/index.ts")];
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    if (!file.endsWith(".ts") && !file.endsWith(".tsx")) continue;
    const text = readFileSync(file, "utf-8");
    for (const m of text.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)) {
      const target = resolveImport(file, m[1]);
      if (target) queue.push(target);
    }
  }
  return [...seen];
}

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? filesUnder(join(dir, e.name)) : [join(dir, e.name)]));
}

/** What the snapshot depends on: the seed and everything it imports, the schema and migrations, the GLEIF cache, and the clock it ran at. */
export function snapshotInputHash(): string {
  const files = new Set([
    ...seedImportClosure(),
    join(ROOT, "prisma/schema.prisma"),
    join(ROOT, "data/gleif-cache.json"),
    ...filesUnder(join(ROOT, "prisma/migrations")),
  ]);
  const hash = createHash("sha256");
  hash.update(SNAPSHOT_CLOCK_START);
  for (const file of [...files].sort()) {
    hash.update(relative(ROOT, file));
    hash.update(readFileSync(file));
  }
  return hash.digest("hex");
}

const EXCLUDED = ["DemoMeta", "DemoSandbox", "_prisma_migrations"];

/** Insert order: every table after the tables its foreign keys point to. Fails on a cycle between tables. */
export async function insertOrder(db: PrismaClient): Promise<string[]> {
  const tables = (await db.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`)
    .map((r) => r.tablename)
    .filter((t) => !EXCLUDED.includes(t))
    .sort();
  const fks = await db.$queryRaw<{ child: string; parent: string }[]>`
    SELECT c.relname AS child, p.relname AS parent
    FROM pg_constraint k
    JOIN pg_class c ON c.oid = k.conrelid
    JOIN pg_class p ON p.oid = k.confrelid
    WHERE k.contype = 'f' AND k.connamespace = 'public'::regnamespace`;
  const parents = new Map(tables.map((t) => [t, new Set<string>()]));
  for (const { child, parent } of fks) if (child !== parent && parents.has(child) && parents.has(parent)) parents.get(child)!.add(parent);
  const ordered: string[] = [];
  const placed = new Set<string>();
  while (ordered.length < tables.length) {
    const next = tables.filter((t) => !placed.has(t) && [...parents.get(t)!].every((p) => placed.has(p)));
    if (next.length === 0) throw new Error(`Foreign keys form a cycle between tables: ${tables.filter((t) => !placed.has(t)).join(", ")}`);
    for (const t of next) {
      placed.add(t);
      ordered.push(t);
    }
  }
  return ordered;
}

/** Reads every data table of the (already seeded) database into a snapshot. Rows keep their insertion order. */
export async function dumpSnapshot(db: PrismaClient, seedToday: string): Promise<DemoSnapshot> {
  const tables: DemoSnapshot["tables"] = [];
  for (const name of await insertOrder(db)) {
    const [{ rows }] = await db.$queryRawUnsafe<{ rows: Record<string, unknown>[] }[]>(
      `SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.ctid), '[]'::jsonb) AS rows FROM "${name}" t`,
    );
    tables.push({ name, rows });
  }
  const [{ last_value, is_called }] = await db.$queryRaw<{ last_value: bigint; is_called: boolean }[]>`SELECT last_value, is_called FROM issue_number_seq`;
  return { version: 1, seedToday, inputHash: snapshotInputHash(), tables, issueNumberNext: Number(last_value) + (is_called ? 1 : 0) };
}
