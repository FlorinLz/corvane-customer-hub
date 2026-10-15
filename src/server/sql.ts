import type { Prisma, PrismaClient } from "@prisma/client";

import { sandboxSearchPath } from "@/lib/sandbox";
import { currentSandboxSchema } from "@/server/sandbox-context";

type RawClient = Pick<PrismaClient, "$queryRaw" | "$executeRaw"> | Prisma.TransactionClient;

/**
 * The only way to run Prisma's raw SQL ($queryRaw, $executeRaw). The Prisma client qualifies its generated queries with the visitor's schema, but raw
 * SQL names tables bare, so it would hit the public schema. This runs `fn` inside a transaction whose first statement is
 * `set_config('search_path', '<sandbox>, public', true)`; the `true` keeps it to this transaction, which is what survives Neon's pooler.
 *
 * `client` is `db` (a transaction is opened) or a transaction client the caller already has (its transaction gets the search_path). For the public
 * schema nothing is set and `fn` runs in a transaction only when the caller passes `transaction` options (the duplicate check does, for its
 * transaction-local pg_trgm.similarity_threshold). tests/unit/raw-sql-guard.test.ts fails on a raw call that is not made on the `tx` this hands out.
 */
export async function withSearchPath<T>(
  client: RawClient,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options: { schema?: string; transaction?: { maxWait?: number; timeout?: number } } = {},
): Promise<T> {
  const schema = options.schema ?? currentSandboxSchema();
  const run = async (tx: Prisma.TransactionClient) => {
    if (schema) await tx.$executeRaw`SELECT set_config('search_path', ${sandboxSearchPath(schema)}, true)`;
    return fn(tx);
  };
  const transactional = client as PrismaClient;
  // A sandbox needs its transaction for the search_path; the public schema needs one only when the caller asked for it (options), so the shared
  // demo's single-connection pool is not held for a second statement it does not need.
  if (typeof transactional.$transaction === "function" && (schema || options.transaction)) return transactional.$transaction(run, options.transaction);
  return run(client as Prisma.TransactionClient); // already a transaction (or a test double): the caller owns it
}
