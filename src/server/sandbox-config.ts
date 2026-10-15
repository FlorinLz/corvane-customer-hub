/** Settings of the per-visitor sandboxes. All from the environment, read when used so tests can change them. */

/**
 * Whether visitors get a private copy of the demo data. Opt in with DEMO_SANDBOXES=true: the demo mode, the admin connection (a sandbox is made with the
 * owner role) and the flag. Without it the app is the shared demo it always was, and every existing test runs on the public schema.
 */
export function sandboxesEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.DEMO_MODE === "true" && env.DEMO_SANDBOXES === "true" && !!env.DATABASE_ADMIN_URL;
}

function positiveInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && value !== undefined && value.trim() !== "" ? n : fallback;
}

/** Sandboxes kept ready (created, not yet claimed), so a new visitor does not wait for a schema to be built. */
export function sandboxSpares(env: Record<string, string | undefined> = process.env): number {
  return positiveInt(env.DEMO_SANDBOX_SPARES, 2);
}

/**
 * The most sandboxes (assigned and spare) that exist at once. Past it a new visitor uses the shared demo. The default comes from
 * `npm run sandbox:measure`: see DECISIONS.md "Sandbox per visitor".
 */
export const DEFAULT_SANDBOX_MAX = 100;
export function sandboxMax(env: Record<string, string | undefined> = process.env): number {
  return positiveInt(env.DEMO_SANDBOX_MAX, DEFAULT_SANDBOX_MAX);
}

/** How many sandbox Prisma clients one instance keeps. */
export function sandboxClientCacheSize(env: Record<string, string | undefined> = process.env): number {
  return Math.max(1, positiveInt(env.DEMO_SANDBOX_CLIENT_CACHE, 20));
}
