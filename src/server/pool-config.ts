import type { PoolConfig } from "pg";

/**
 * Connection limits for every pg pool the app opens (runtime client and admin client).
 *
 * On Vercel each function instance has its own pool, and Neon Free has few connection slots, so a
 * pool of the default size (10) per instance runs the database out of slots ("Too many database
 * connections", "remaining connection slots are reserved for SUPERUSER"). One connection per instance,
 * released quickly when idle, keeps the total at (number of live instances), and Neon's pooler
 * (DATABASE_URL with the "-pooler" host) multiplexes those onto a few real backends.
 *
 * Nothing here is specific to the pooler: queries are unnamed (the Prisma pg adapter sets no
 * statement names), and the restore uses transaction-scoped advisory locks, so a transaction-mode
 * pooler is safe. DB_POOL_MAX exists for local experiments only; leave it unset.
 */
export function poolConfig(connectionString: string | undefined): PoolConfig {
  const max = Number(process.env.DB_POOL_MAX);
  return {
    connectionString,
    max: Number.isInteger(max) && max > 0 ? max : 1,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 15_000,
    // Let the process exit (scripts, tests) without waiting for the idle timer.
    allowExitOnIdle: true,
  };
}
