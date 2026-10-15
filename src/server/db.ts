import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

import { LruCache } from "@/lib/lru";
import { assertSandboxSchemaName } from "@/lib/sandbox";
import { poolConfig } from "@/server/pool-config";
import { sandboxClientCacheSize } from "@/server/sandbox-config";
import { currentSandboxSchema } from "@/server/sandbox-context";

/**
 * `db` is the one import every file uses, and it is not one client. It resolves, call by call, to the PrismaClient of the current request's sandbox
 * (the signed ch_sandbox cookie, read by currentSandboxSchema()), or to the public client outside a request (scripts, tests, cron) and for a
 * visitor on the shared demo.
 *
 *  - Every client sits on the same pg.Pool: one connection per instance (pool-config.ts), whatever the number of sandboxes. A client differs from
 *    the others only by `new PrismaPg(pool, { schema })`, which puts that schema in front of every table and enum cast Prisma generates.
 *  - Clients are kept in an LRU cache (DEMO_SANDBOX_CLIENT_CACHE, default 20). Evicting one only drops the client object; the pool stays.
 *  - Prisma's raw SQL ($queryRaw, $executeRaw) is NOT qualified by that option. It runs through withSearchPath() in src/server/sql.ts, which sets
 *    the transaction's search_path to the sandbox. tests/unit/raw-sql-guard.test.ts fails on a raw call outside that helper.
 *  - Nothing here sets a session search_path: Neon's transaction-mode pooler hands out a different backend per transaction, so only
 *    set_config(..., true) inside a transaction is reliable.
 */
const globals = globalThis as unknown as { __corvanePool?: Pool; __corvanePublicDb?: PrismaClient; __corvaneSandboxDbs?: LruCache<string, PrismaClient> };

function runtimePool(): Pool {
  return (globals.__corvanePool ??= new Pool(poolConfig(process.env.DATABASE_URL)));
}

/** The shared runtime pool, for the few plain-SQL reads outside Prisma (the sandbox registry). */
export { runtimePool };

function publicClient(): PrismaClient {
  return (globals.__corvanePublicDb ??= new PrismaClient({ adapter: new PrismaPg(runtimePool()) }));
}

function sandboxClient(schema: string): PrismaClient {
  const cache = (globals.__corvaneSandboxDbs ??= new LruCache<string, PrismaClient>(sandboxClientCacheSize(), (_schema, evicted) => {
    void evicted.$disconnect().catch(() => undefined); // the pool is shared and external: this only drops the client
  }));
  let client = cache.get(schema);
  if (!client) {
    client = new PrismaClient({ adapter: new PrismaPg(runtimePool(), { schema: assertSandboxSchemaName(schema) }) });
    cache.set(schema, client);
  }
  return client;
}

/** The client for `schema`, or the public one for undefined. Exported for the tests. */
export function clientFor(schema: string | undefined): PrismaClient {
  return schema ? sandboxClient(schema) : publicClient();
}

export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = clientFor(currentSandboxSchema());
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
  has(_target, prop) {
    return Reflect.has(clientFor(currentSandboxSchema()), prop);
  },
});
